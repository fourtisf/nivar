/** Domain error with a stable code + HTTP status, surfaced to the client. */
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message?: string, status = 400) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

export const Errors = {
  unauthorized: () => new ApiError("unauthorized", "Authentication required", 401),
  unknownBuilding: () => new ApiError("unknown_building", "No such facility"),
  builderBusy: () => new ApiError("builder_busy", "Builder busy with another job"),
  maxForRig: () => new ApiError("max_for_rig", "Facility can't exceed the Rig level"),
  insufficient: () => new ApiError("insufficient_resources", "Not enough resources"),
  insufficientNivar: () => new ApiError("insufficient_nivar", "Not enough $NIVAR"),
  noJob: () => new ApiError("no_job", "No active build job"),
  notOwned: () => new ApiError("not_owned", "Hero not owned"),
  alreadyEquipped: () => new ApiError("already_equipped", "Hero already equipped"),
  squadFull: () => new ApiError("squad_full", "Squad full (5/5)"),
  notEquipped: () => new ApiError("not_equipped", "Hero not equipped"),
  notEnoughShards: () => new ApiError("not_enough_shards", "Not enough shards"),
  unknownStage: () => new ApiError("unknown_stage", "No such raid"),
  stageLocked: () => new ApiError("stage_locked", "Clear the previous stage first"),
  onCooldown: () => new ApiError("on_cooldown", "Raid on cooldown"),
  unknownTech: () => new ApiError("unknown_tech", "No such tech"),
  techMaxed: () => new ApiError("tech_maxed", "Tech already maxed"),
  questNotClaimable: () => new ApiError("quest_not_claimable", "Quest not claimable"),
  chestNotReady: () => new ApiError("chest_not_ready", "Chest not ready"),
  airdropSoon: () => new ApiError("airdrop_soon", "Airdrop not ready yet"),
  genesisClaimed: () => new ApiError("genesis_claimed", "Genesis Pack already claimed"),
  badRequest: (m?: string) => new ApiError("bad_request", m ?? "Bad request"),
};
