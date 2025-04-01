export interface Faction {
  id: string;
  name: string;
  leader_id: string;
  created_at: string;
  members: FactionMember[];
}

export interface FactionMember {
  id: string;
  faction_id: string;
  user_id: string;
  role: 'LEADER' | 'OFFICER' | 'MEMBER';
  joined_at: string;
}

export interface Fine {
  id: string;
  faction_id: string;
  user_id: string;
  amount: number;
  reason: string;
  issued_by: string;
  created_at: string;
  paid: boolean;
}

export interface Meeting {
  id: string;
  faction_id: string;
  title: string;
  description: string;
  scheduled_for: string;
  created_by: string;
  attendees: string[];
}