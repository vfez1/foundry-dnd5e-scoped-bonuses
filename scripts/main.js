const MODULE_ID = "dnd5e-scoped-bonuses";

/* -------------------------------------------- */
/* Constants                                    */
/* -------------------------------------------- */

const CLASS_IDENTIFIERS = [
    "artificer",
    "barbarian",
    "bard",
    "cleric",
    "druid",
    "fighter",
    "monk",
    "paladin",
    "ranger",
    "rogue",
    "sorcerer",
    "warlock",
    "wizard",
];

const FLAG_ROOT = `flags.${MODULE_ID}.class.spell`;

/* -------------------------------------------- */
/* Logging (deduplicated)                       */
/* -------------------------------------------- */

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
/* Utility                                      */
/* -------------------------------------------- */

function flagPath(type, cls) {
    return `${FLAG_ROOT}.${type}.${cls}`;
}

function getBonusFromEffects(actor, key) {
    let total = 0;

    const actorEffects = actor.effects ?? [];
    const itemEffects = actor.items.contents.flatMap(
        (i) => i.effects?.contents ?? [],
    );

    for (const effect of [...actorEffects, ...itemEffects]) {
        if (effect.disabled || effect.suppressed) continue;

        for (const change of effect.changes) {
            if (change.key === key) {
                total += Number(change.value) || 0;
            }
        }
    }

    return total;
}

/* -------------------------------------------- */
/* DAE Autocomplete Registration                */
/* -------------------------------------------- */

function registerWithDAE() {
    const dae = game.modules.get("dae");
    if (!dae?.active) return;

    const api = dae.api;
    if (!api) return;

    const fields = [];

    for (const cls of CLASS_IDENTIFIERS) {
        const label = cls.charAt(0).toUpperCase() + cls.slice(1);

        const dcKey = flagPath("dc", cls);
        const atkKey = flagPath("attack", cls);

        fields.push({ name: dcKey }, { name: atkKey });

        api.localizationMap[dcKey] = {
            name: `${label} Spell DC`,
            description: `Bonus to spell save DC for ${label} spells`,
        };

        api.localizationMap[atkKey] = {
            name: `${label} Spell Attack`,
            description: `Bonus to spell attack rolls for ${label} spells`,
        };
    }

    api.addAutoFields(fields);

    console.log(
        `${MODULE_ID} | Registered ${fields.length} DAE autocomplete keys.`,
    );
}

/* -------------------------------------------- */
/* Activity Bonuses                             */
/* -------------------------------------------- */

function applyActivityBonuses(activity, type) {
    const item = activity.item ?? activity.parent;
    const actor = item?.actor ?? item?.parent;

    if (!actor || actor.type !== "character" || item?.type !== "spell") return;

    const sourceClass = item.system.sourceClass?.toLowerCase();
    if (!sourceClass) return;

    const bonus = getBonusFromEffects(actor, flagPath(type, sourceClass));
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
        "WRAPPER",
    );

    // Save Activities
    libWrapper.register(
        MODULE_ID,
        "dnd5e.documents.activity.SaveActivity.prototype.prepareFinalData",
        function (wrapped, ...args) {
            wrapped(...args);
            applyActivityBonuses(this, "dc");
        },
        "WRAPPER",
    );

    // Spellcasting Header
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

// Register DAE fields once it is fully ready
Hooks.once("DAE.setupComplete", registerWithDAE);
