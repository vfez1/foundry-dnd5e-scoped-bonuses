const MODULE_ID = "dnd5e-scoped-bonuses";

const FLAG_ROOT = `flags.${MODULE_ID}.class.spell`;

/* -------------------------------------------- */
/* Utility                                      */
/* -------------------------------------------- */

function flagPath(type, cls) {
    return `${FLAG_ROOT}.${type}.${cls}`;
}

function normalizeScopedIdentifier(value) {
    if (typeof value !== "string") return null;

    const normalized = value.toLowerCase();
    const stripped = normalized.includes(":") ? normalized.split(":").pop() : normalized;
    return stripped || null;
}

function getBonusFromEffects(actor, key) {
    let total = 0;

    const actorEffects = actor.effects ?? [];
    const itemEffects = actor.items.contents.flatMap((i) => i.effects?.contents ?? []);

    for (const effect of [...actorEffects, ...itemEffects]) {
        if (effect.disabled || effect.isSuppressed || effect.active === false) continue;

        for (const change of effect.changes) {
            if (change.key === key) {
                total += Number(change.value) || 0;
            }
        }
    }

    return total;
}

/* -------------------------------------------- */
/* Activity Bonuses                             */
/* -------------------------------------------- */

function applyActivityBonuses(activity, type) {
    const item = activity.item ?? activity.parent;
    const actor = item?.actor ?? item?.parent;

    if (!actor || actor.type !== "character" || item?.type !== "spell") return;

    // dnd5e 5.3 introduced `system.sourceItem` and deprecated the `system.sourceClass` getter.
    // Feature-detect with `in` so we only read the field that the schema actually defines,
    // staying silent on both v13/5.2.5 and v14/5.3.3.
    const rawSource = "sourceItem" in (item.system ?? {}) ? item.system.sourceItem : item.system.sourceClass;
    const sourceClass = normalizeScopedIdentifier(rawSource);
    const key = sourceClass ? flagPath(type, sourceClass) : null;

    if (!sourceClass) {
        return;
    }

    const bonus = getBonusFromEffects(actor, key);
    if (!bonus) return;

    if (type === "attack") {
        const current = activity.attack?.bonus || "";
        activity.attack.bonus = current ? `${current} + ${bonus}` : `${bonus}`;
    }

    if (type === "dc" && activity.save?.dc) {
        activity.save.dc.value += bonus;
    }

    activity.prepareLabels?.();
}

/* -------------------------------------------- */
/* Hooks                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
    // Attack Activities
    libWrapper.register(
        MODULE_ID,
        "dnd5e.documents.activity.AttackActivity.prototype.prepareData",
        function (wrapped, ...args) {
            wrapped(...args);
            applyActivityBonuses(this, "attack");
        },
        "WRAPPER"
    );

    // Save Activities
    libWrapper.register(
        MODULE_ID,
        "dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData",
        function (wrapped, ...args) {
            wrapped(...args);
            applyActivityBonuses(this, "dc");
        },
        "WRAPPER"
    );

    // Spellcasting Header
    libWrapper.register(
        MODULE_ID,
        "CONFIG.Actor.documentClass.prototype._prepareSpellcasting",
        function (wrapped, ...args) {
            wrapped(...args);

            if (this.type !== "character") return;

            for (const classItem of this.items.filter((i) => i.type === "class")) {
                const identifier = classItem.system.identifier?.toLowerCase();
                const spellcasting = classItem.system.spellcasting;

                if (!identifier || !spellcasting) continue;

                const dcBonus = getBonusFromEffects(this, `flags.${MODULE_ID}.class.spell.dc.${identifier}`);

                const attackBonus = getBonusFromEffects(this, `flags.${MODULE_ID}.class.spell.attack.${identifier}`);

                if (dcBonus) {
                    spellcasting.save = (Number(spellcasting.save) || 0) + dcBonus;
                }

                if (attackBonus) {
                    spellcasting.attack = (Number(spellcasting.attack) || 0) + attackBonus;
                }
            }
        },
        "WRAPPER"
    );
});
