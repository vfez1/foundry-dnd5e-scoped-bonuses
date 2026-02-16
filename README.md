# DnD5E Scoped Bonuses

A lightweight Foundry VTT module for **D&D5e** that enables class-specific spellcasting bonuses via Active Effects. Perfect for multiclassing or items that boost one power source without affecting others.

## ✨ Features

- **Class-Scoped:** Apply bonuses strictly to one class (e.g., +1 DC to Wizard spells only).
- **UI Integration:** Automatically updates **Spellcasting Headers** in the spellbook.
- **Non-Destructive:** Operates as a wrapper layer; does not modify your core database.
- **Smart Logging:** Verification logs appear in the console only when values change.

## 🛠️ How to Use

### 1. Configure the Bonus

Add an Active Effect to a Character or an Item using these flag keys:

| Target           | Flag Key Pattern                                            |
| :--------------- | :---------------------------------------------------------- |
| **Spell DC**     | `flags.dnd5e-scoped-bonuses.class.spell.dc.[classname]`     |
| **Spell Attack** | `flags.dnd5e-scoped-bonuses.class.spell.attack.[classname]` |

**Example:** To give a Cleric a **+2 bonus** to spell attacks:

- **Key:** `flags.dnd5e-scoped-bonuses.class.spell.attack.cleric`
- **Mode:** `Add`
- **Value:** `2`

### 2. Verify Spell Settings

For a spell to receive the bonus, ensure its **Source Class** is set to match the class name you used in the key.

---

## ⚙️ Technical Details

- **Dependencies:** `libWrapper`
- **Scope:** Character actors and Spell items only.
- **Stacking:** Multiple effects stack additively.
- **Performance:** Recalculated during data preparation; zero permanent impact on actor data.

## 📝 Summary

✔ Class-specific DC & Attack bonuses  
✔ System-safe injection via libWrapper
✔ Tested with D&D5e v5.x
