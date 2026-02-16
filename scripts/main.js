const MODULE_ID = "dnd5e-scoped-bonuses";

// Map to track last logged values to prevent spam
const logCache = new Map();

/**
 * Logs only when the message content changes for a specific actor/field
 */
function smartLog(actorId, key, message) {
    const cacheKey = `${actorId}-${key}`;
    if (logCache.get(cacheKey) !== message) {
        console.log(`${MODULE_ID} | ${message}`);
        logCache.set(cacheKey, message);
    }
}

/* -------------------------------------------- */
/* Setup Wrappers                              */
/* -------------------------------------------- */

Hooks.once("setup", () => {
    // Attack Activity (early pass)
    libWrapper.register(
        MODULE_ID,
        "dnd5e.documents.activity.AttackActivity.prototype.prepareData",
        function (wrapped, ...args) {
            wrapped(...args);
            applyActivityBonuses(this, "attack");
        },
        "WRAPPER",
    );

    // Save Activity (late pass)
    libWrapper.register(
        MODULE_ID,
        "dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData",
        function (wrapped, ...args) {
            wrapped(...args);
            applyActivityBonuses(this, "dc");
        },
        "WRAPPER",
    );

    // Spellcasting Header (class spellbook UI)
    libWrapper.register(
        MODULE_ID,
        "CONFIG.Actor.documentClass.prototype._prepareSpellcasting",
        function (wrapped, ...args) {
            wrapped(...args);

            if (this.type !== "character") return;

            for (const classItem of this.items.filter(
                (i) => i.type === "class",
            )) {
                const identifier = classItem.system.identifier?.toLowerCase();
                const spellcasting = classItem.system.spellcasting;

                if (!identifier || !spellcasting) continue;

                const dcBonus = getBonusFromEffects(
                    this,
                    `flags.${MODULE_ID}.class.spell.dc.${identifier}`,
                );

                const attackBonus = getBonusFromEffects(
                    this,
                    `flags.${MODULE_ID}.class.spell.attack.${identifier}`,
                );

                if (dcBonus) {
                    spellcasting.save =
                        (Number(spellcasting.save) || 0) + dcBonus;
                    smartLog(
                        this.id,
                        `${identifier}-dc`,
                        `${this.name} ${identifier} DC +${dcBonus}`,
                    );
                }

                if (attackBonus) {
                    spellcasting.attack =
                        (Number(spellcasting.attack) || 0) + attackBonus;
                    smartLog(
                        this.id,
                        `${identifier}-attack`,
                        `${this.name} ${identifier} Attack +${attackBonus}`,
                    );
                }
            }
        },
        "WRAPPER",
    );
});

/* -------------------------------------------- */
/* Force One-Time Derived Refresh              */
/* -------------------------------------------- */

Hooks.once("ready", async () => {
    for (const actor of game.actors.contents) {
        if (actor.type !== "character") continue;

        await actor.update({}, { diff: false, recursive: false });
    }
});

/* -------------------------------------------- */
/* Activity-Level Bonus Application            */
/* -------------------------------------------- */

function applyActivityBonuses(activity, type) {
    const item = activity.item ?? activity.parent;
    const actor = item?.actor ?? item?.parent;

    if (!actor || actor.type !== "character") return;
    if (item?.type !== "spell") return;

    const sourceClass = item.system.sourceClass?.toLowerCase();
    if (!sourceClass) return;

    const flagKey = `flags.${MODULE_ID}.class.spell.${type}.${sourceClass}`;

    const bonus = getBonusFromEffects(actor, flagKey);
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
/* Effect Flag Aggregation                     */
/* -------------------------------------------- */

function getBonusFromEffects(actor, flagKey) {
    let total = 0;

    const actorEffects = actor.effects ?? [];
    const itemEffects = actor.items.contents.flatMap(
        (i) => i.effects?.contents ?? [],
    );

    for (const effect of [...actorEffects, ...itemEffects]) {
        if (effect.disabled || effect.suppressed) continue;

        for (const change of effect.changes) {
            if (change.key === flagKey) {
                total += Number(change.value) || 0;
            }
        }
    }

    return total;
}
