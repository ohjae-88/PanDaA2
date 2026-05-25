export type PartyJob = "수호성" | "검성" | "치유성" | "호법성" | "궁성" | "마도성" | "살성" | "정령성";

export type PartyCharacter = {
  id: string;
  name: string;
  job: PartyJob | string;
  /** 본케/부케 */
  type: "main" | "sub";
  cp?: number;
  itemLevel?: number;
  /** aion2.plaync.com 게임 ID — 장비 모달 조회용 */
  characterId?: string;
  /** 서버 ID (숫자, 예: 1010) */
  serverId?: number;
};

export type Player = {
  id: string;
  name: string;
  characters: PartyCharacter[];
};

export type PartyServer = {
  name: string;
  serverId: number;
  race: "천족" | "마족" | string;
};

export type Participant = {
  playerId: string;
  /** 그룹에 참여시킬 캐릭터 id 목록 */
  selectedCharIds: string[];
};

/** 분배 규칙 — V4.0.9 호환 */
export type RuleType = "class" | "set" | "main";

export type DistributeRule = {
  id: string;
  type: RuleType;
  name?: string;
  /** class: 특정 파티에 특정 직업 최소 인원 */
  partyIndices?: number[];  // 0-based
  jobs?: string[];
  minCount?: number;
  /** set: 특정 세트에 특정 플레이어 포함/제외 */
  setIndices?: number[];    // 0-based
  playerIds?: string[];
  mode?: "include" | "exclude";
  /** main: 본/부 비율 제약 */
  scope?: "set" | "party";
  targetIndices?: number[];
  maxCount?: number;
};

export type GeneratedSlot = {
  playerId: string | null;
  charId: string | null;
  /** 빈 슬롯(공석) — UI에서 드롭 가능 표시 */
  isOpen: boolean;
};

export type GeneratedParty = {
  name: string;
  slots: GeneratedSlot[];
};

/** 미배치 캐릭터 (파티 슬롯에 들어가지 못한 풀 잔여) */
export type UnassignedItem = {
  playerId: string;
  charId: string;
};

export type GeneratedSet = {
  id: string;
  name: string;
  parties: GeneratedParty[];
  unassigned?: UnassignedItem[];
};

export type ComposeMode = "balanced" | "random" | "tier";

export type PartyGroup = {
  id: string;
  name: string;
  participants: Participant[];
  distributeRules: DistributeRule[];
  setCount: number;
  partyCount: number;
  composeMode: ComposeMode;
  generatedSets: GeneratedSet[];
  composed: boolean;
  /** 한 캐릭터가 여러 세트에 중복 사용 허용 */
  allowDup: boolean;
};

export type PartyState = {
  players: Player[];
  groups: PartyGroup[];
  activeGroupId: string | null;
  servers: PartyServer[];
  defaultServerId: number | null;
};

export type PlayerSortMode = "name" | "cp";
