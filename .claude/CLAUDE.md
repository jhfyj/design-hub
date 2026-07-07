# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# motion
- **motion** (`.claude/skills/motion/SKILL.md`) - adding or extending animation/interaction motion in design-hub (Motion for React, aka `framer-motion`). Trigger: `/motion`, or any request to animate an interaction.
Before adding animation to any interaction, read the motion skill first — it documents which easing/spring conventions to reuse and where Motion is already applied (`client/src/components/TodoWidget.tsx`).
