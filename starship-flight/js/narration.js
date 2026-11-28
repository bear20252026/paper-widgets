// Console narration. No em dashes anywhere in the copy.
export const VIEW_LINES = {
  painted: 'Painted view. Stainless steel, the tile field, the tower, and the vapor off the tanks.',
  cutaway: 'Cutaway. A section plane through the centreline; cut metal is hatched orange and the propellant levels are live.',
  plume: 'Plume view. Everything but the engines fades to paper so the shock diamonds can be read.',
  exploded: 'Exploded view. Each major assembly backs away from the stack along its own axis.',
  explodedWait: 'Exploded view waits for a safe state: the vehicle on the pad, or recovered.',
};

export function lineFor(e, s) {
  switch (e.type) {
    case 'armed': return 'Range safety switch is ARMED. Press IGNITE, or Space, to start the terminal count.';
    case 'safed': return 'Switch back to SAFE. The count cannot start.';
    case 'count': return 'Terminal count. Engine chill is complete and the tanks are pressurising.';
    case 'ignition': return 'Ignition. Thirty-three Raptors light in sequence and ramp from 40 to 100 percent.';
    case 'liftoff': return 'Range is green. The hold-down clamps release at T zero and the stack clears the mount.';
    case 'tower_clear': return 'Tower clear. The stack is pitching downrange over the Gulf.';
    case 'abort': return e.reason === 'thrust_low' ? 'Abort. Thrust did not reach the modelled clamp-release margin. The clamps held.' : 'Abort on the pad. Engines are safed and the clamps are holding.';
    case 'maxq': return `Max Q at ${(e.q / 1000).toFixed(1)} kPa, modelled. The vehicle is through the thickest part of the atmosphere.`;
    case 'meco': return 'MECO. Thirty of the booster engines shut down; three centre engines hold the stack steady for staging.';
    case 'stage_cmd': return s.mecoT === null ? 'STAGE is armed inside the window. The ship will light at MECO.' : 'STAGE. The ship is lighting.';
    case 'hot_staging': return e.offNominal ? 'Stage command far ahead of MECO. The ship is lighting against a booster at full thrust.' : 'Hot staging. The ship lights while it is still attached; exhaust vents through the ring.';
    case 'ship_ignition': return 'Ship engines are up. Interstage pressure is venting.';
    case 'separation': return 'Separation. The ship pulls away and the ring stays with the booster.';
    case 'boostback_start': return 'The booster has turned around. Boostback burn on thirteen centre engines.';
    case 'boostback_end': return e.short ? 'Boostback cut short to protect the landing propellant. The booster will not make the tower.' : 'Boostback complete. Grid fins are steering the booster back toward the tower.';
    case 'budget_low': return 'Propellant budget is short of a full return. The catch will not be attempted.';
    case 'entry_burn': return 'Booster entry burn, modelled, to take the edge off the descent.';
    case 'catch_go': return 'Catch is GO. The booster is inside the modelled position and propellant envelope.';
    case 'catch_nogo': return !e.propOk ? 'Catch is NO-GO on propellant. The booster diverts to the water.' : 'Catch is NO-GO on trajectory. The booster diverts offshore.';
    case 'landing_burn': return e.target === 'tower' ? 'Landing burn. Thirteen engines, then three. The chopsticks are closing.' : 'Landing burn over the water.';
    case 'catch': return 'Caught. The chopsticks closed on the catch pins. The booster is inside the catch envelope.';
    case 'splashdown': return e.hard ? 'The booster hit the water hard. It is lost.' : (s.recovery === 'catch' ? 'The catch was not made. The booster is in the water.' : 'Booster splashdown, as selected. A soft landing on the water.');
    case 'seco': return e.short ? 'SECO on a propellant limit, modelled. The ship is coasting.' : 'SECO. The ship is on its modelled near-orbital coast. Time is compressed.';
    case 'ship_reentry': return 'Entry interface. The ship rolls belly first and the flaps take over.';
    case 'peak_heating': return 'The ship is through peak heating. The tile field held.';
    case 'ship_landing_burn': return 'Flip and landing burn on the three sea-level Raptors.';
    case 'ship_splashdown': return 'Ship splashdown in the Indian Ocean, modelled. Both stages are accounted for.';
    case 'failure':
      if (e.reason === 'thermal') return 'The ship is lost. The modelled thermal margin was exceeded.';
      if (e.reason === 'late_staging') return 'Staging window closed without a command. The flight is lost.';
      if (e.reason === 'early_staging') return 'Off-nominal staging. Interstage overpressure.';
      if (e.reason === 'catch_envelope') return 'The catch failed. The booster is in the water.';
      if (e.reason === 'flight_termination') return 'TERMINATE. Flight termination is commanded.';
      if (e.reason === 'impact') return e.body === 'ship' ? 'The ship came down without a landing burn.' : 'The stack is coming down on a ballistic arc.';
      return 'Off-nominal event.';
    case 'vehicle_lost': return e.body === 'ship' ? 'The ship is lost. ' + (e.reason ? e.reason.charAt(0).toUpperCase() + e.reason.slice(1) + '.' : '') : (e.body === 'booster' ? 'The booster is lost.' : 'The vehicle is lost. ' + (e.reason || ''));
    case 'cut': return s.liftoffT === null ? 'CUT. Engines commanded off.' : 'CUT. All engines off. The vehicle continues on a ballistic trajectory.';
    case 'depletion': return `${e.body === 'ship' ? 'Ship' : 'Booster'} propellant depleted. Engines shut down.`;
    case 'mission_end': return 'Flight complete. Press RECYCLE to put a fresh stack on the mount.';
  }
  return null;
}

export const LOG_LABEL = {
  armed: 'ARM', count: 'COUNT', ignition: 'IGNITION', liftoff: 'LIFTOFF', tower_clear: 'TOWER CLEAR', maxq: 'MAX Q', meco: 'MECO',
  stage_cmd: 'STAGE CMD', hot_staging: 'HOT STAGING', ship_ignition: 'SHIP IGNITION', separation: 'SEPARATION', boostback_start: 'BOOSTBACK START',
  boostback_end: 'BOOSTBACK END', entry_burn: 'ENTRY BURN', catch_go: 'CATCH GO', catch_nogo: 'CATCH NO-GO', landing_burn: 'LANDING BURN',
  catch: 'CATCH', splashdown: 'S1 SPLASHDOWN', seco: 'SECO', ship_reentry: 'SHIP REENTRY', peak_heating: 'PEAK HEATING',
  ship_landing_burn: 'S2 LANDING BURN', ship_splashdown: 'SHIP SPLASHDOWN', failure: 'FAILURE', vehicle_lost: 'VEHICLE LOST', cut: 'CUT',
  terminate: 'TERMINATE', abort: 'ABORT', depletion: 'DEPLETION', budget_low: 'BUDGET LOW', mission_end: 'END', safed: 'SAFE',
};
