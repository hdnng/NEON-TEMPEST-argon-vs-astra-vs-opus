import { type FighterId } from "../core/types";
export interface Trial {
  name: string;
  description: string;
  steps: string[];
}
export function trialsFor(id: FighterId): Trial[] {
  const n = id === "magnus" || id === "warden" ? 2 : 0;
  return [
    {
      name: "01 / FIRST CONTACT",
      description:
        "Chain a light punch into a medium punch. Press the second button as the first connects.",
      steps: ["stand_LP", "stand_MP"],
    },
    {
      name: "02 / CURRENT FLOW",
      description:
        "Confirm two low attacks into a light special. Begin the motion during the second hit.",
      steps: ["crouch_LK", "crouch_MP", `special${n}_0`],
    },
    {
      name: "03 / FULL RESONANCE",
      description:
        "Cancel medium punch into an EX special, then spend another stock on your Super Art.",
      steps: ["stand_MP", `special${n}_3`, "super"],
    },
  ];
}
