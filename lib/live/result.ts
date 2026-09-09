import type { Snapshot } from './world.ts';

export function liveResultDetails(
  snapshot: Snapshot | null,
  completed: boolean,
) {
  if (!snapshot || !completed) return {};
  if (snapshot.cancelled)
    return { liveMode: snapshot.mode, reason: 'Match cancelled' };
  const standings = snapshot.actors
    .map((actor) => ({
      id: actor.id,
      name: actor.name,
      team: actor.team,
      you: actor.id === 0,
      kills: actor.kills,
      deaths: actor.deaths,
    }))
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id - b.id);
  const me = standings.find((player) => player.you);
  // FFA victory is based on kills; tied kills share a position.
  const place = me
    ? 1 + standings.filter((player) => player.kills > me.kills).length
    : undefined;
  return {
    standings,
    liveMode: snapshot.mode,
    placement: snapshot.mode === 'ffa' ? place : undefined,
    reason:
      snapshot.mode === 'ffa'
        ? 'FFA complete'
        : snapshot.state.score === snapshot.state.enemyScore
          ? 'Draw'
          : snapshot.won
            ? 'Victory'
            : 'Defeat',
  };
}
