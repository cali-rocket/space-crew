import { MissionDef } from './mission';

/**
 * All 50 missions from The Crew: The Quest for Planet Nine (3-player logbook).
 * Source: logbook-en.pdf (English edition), missions 1–50.
 *
 * Encoding rules (plan §Task 8 mapping):
 *   - taskCount = red octagon number shown on the logbook page
 *   - orderTokens: absolute position (purple 1-5) | last (Ω) | relative (chevron N)
 *   - constraints: derived from highlighted special-rule text and logbook symbols
 *   - communication: dead-zone = 'dead-zone' | disruption = {noCommUntilTrick:N} | one-member = {oneMemberNoComm:true}
 *   - assignment: 'commander-decision' | 'commander-distribution' | 'open-pick' (default)
 *   - optionalHandover: true when commander assigns a specific crew member to a task
 *
 * LIMITATION (M48): The Ω-order token task that must be won in the last trick is
 * encoded as orderTokens:[{kind:'last'}].  The exact card drawn during setup is not
 * known at data-encoding time, so the task-in-last-trick constraint cannot reference
 * a fixed card here.  Runtime card-binding (assigning the Ω token to a specific task
 * card after deal/assignment) is required to evaluate the constraint fully (future work).
 */
export const MISSIONS: MissionDef[] = [
  // ── Page 3 ────────────────────────────────────────────────────────────────
  {
    id: 1,
    sourceText: 'Team building. Training phase 1: Team building.',
    logbookPage: 3,
    taskCount: 1,
  },
  {
    id: 2,
    sourceText: 'Drift compatibility. Face training phases 2 and 3: control technique and weightlessness.',
    logbookPage: 3,
    taskCount: 2,
  },
  {
    id: 3,
    sourceText:
      'The combined Energy Supply and Emergency Prioritization course requires a high degree of logical thinking.',
    logbookPage: 3,
    taskCount: 2,
  },
  {
    id: 4,
    sourceText:
      'The last training phases are the recalibration of the control modules, the reorientation of the communicators and the advanced auxiliary systems of the spacesuits.',
    logbookPage: 3,
    taskCount: 3,
  },
  {
    id: 5,
    sourceText:
      'The sick crew member may not win a single trick.',
    logbookPage: 3,
    taskCount: 3,
    constraints: [{ kind: 'player-trick-count', role: 'sick', count: 0, rocketAllowed: true }],
    assignment: 'open-pick',
  },
  {
    id: 6,
    sourceText:
      'A reception dead spot is simulated, which can lead to a variety of circumstances in space.',
    logbookPage: 3,
    taskCount: 3,
    communication: 'dead-zone',
  },

  // ── Page 4 ────────────────────────────────────────────────────────────────
  {
    id: 7,
    sourceText: '10-9-8-7-6-5-4-3-2-1-LIFT OFF! The completion of your training is just the beginning.',
    logbookPage: 4,
    taskCount: 3,
  },
  {
    id: 8,
    sourceText:
      'You are now ready to leave the moon behind. Start all control and measuring instruments, and ignite the engines.',
    logbookPage: 4,
    taskCount: 3,
  },
  {
    id: 9,
    sourceText: 'A 1-value card must win a trick.',
    logbookPage: 4,
    taskCount: 3,
    constraints: [{ kind: 'win-value-count', value: 1, count: 1 }],
  },
  {
    id: 10,
    sourceText:
      'You are now ready to leave the moon behind. This will truly be a big step. For you and for mankind.',
    logbookPage: 4,
    taskCount: 4,
  },
  {
    id: 11,
    sourceText:
      'The Commander appoints another crew member to take care of the recalculation of the course. The task demands the highest concentration, so the particular crew member cannot communicate in this mission.',
    logbookPage: 4,
    taskCount: 4,
    communication: { oneMemberNoComm: true },
    assignment: 'commander-decision',
  },
  {
    id: 12,
    sourceText:
      'Immediately after the 1st trick, each of you must draw a random card from the crew member to your right. Then continue playing normally.',
    logbookPage: 4,
    taskCount: 4,
    // NOTE: The mid-trick card swap is a setup/deal-phase event, not a persistent game constraint.
    // No engine constraint encoded; handled at the table during setup.
  },

  // ── Page 5 ────────────────────────────────────────────────────────────────
  {
    id: 13,
    sourceText: 'You must win a trick with each Rocket card.',
    logbookPage: 5,
    taskCount: 4,
    constraints: [
      {
        kind: 'win-cards',
        cards: [
          { suit: 'rocket', value: 1 },
          { suit: 'rocket', value: 2 },
          { suit: 'rocket', value: 3 },
          { suit: 'rocket', value: 4 },
        ],
        ordered: false,
      },
    ],
  },
  {
    id: 14,
    sourceText:
      'The sight helps you get over the reception dead spot which you\'re currently stuck in.',
    logbookPage: 5,
    taskCount: 4,
    communication: 'dead-zone',
  },
  {
    id: 15,
    sourceText:
      'You are hit by a meteorite. Immediately seal off the four damaged modules and begin the repair process.',
    logbookPage: 5,
    taskCount: 4,
  },
  {
    id: 16,
    sourceText: 'You cannot win a trick with a 9-value card.',
    logbookPage: 5,
    taskCount: 2,
    constraints: [{ kind: 'forbid-win-value', value: 9 }],
  },
  {
    id: 17,
    sourceText: 'You are still not allowed to win a trick with a 9-value card.',
    logbookPage: 5,
    taskCount: 2,
    constraints: [{ kind: 'forbid-win-value', value: 9 }],
  },
  {
    id: 18,
    sourceText: 'You are only allowed to communicate starting with the 2nd trick.',
    logbookPage: 5,
    taskCount: 5,
    communication: { noCommUntilTrick: 2 },
  },

  // ── Page 6 ────────────────────────────────────────────────────────────────
  {
    id: 19,
    sourceText: 'You may not communicate until the start of the 3rd trick.',
    logbookPage: 6,
    taskCount: 5,
    communication: { noCommUntilTrick: 3 },
  },
  {
    id: 20,
    sourceText:
      'Your Commander determines who receives the orders and carries out the repair.',
    logbookPage: 6,
    taskCount: 5,
    assignment: 'commander-decision',
  },
  {
    id: 21,
    sourceText: 'You hardly notice the reception dead spot.',
    logbookPage: 6,
    taskCount: 5,
    communication: 'dead-zone',
  },
  {
    id: 22,
    sourceText:
      'Reroute the power supply to other modules one by one to avoid a total system failure.',
    logbookPage: 6,
    taskCount: 5,
  },
  {
    id: 23,
    sourceText:
      'Before you select the Order cards, you may change the position of two Order tiles.',
    logbookPage: 6,
    taskCount: 5,
    // NOTE: The "swap 2 order tiles before selection" rule is a pre-game setup option,
    // not a persistent constraint. Handled at the table before task assignment.
  },
  {
    id: 24,
    sourceText:
      'Your Commander takes the initiative and draws up a plan. In order to be able to proceed in a structured way, he distributes the individual orders.',
    logbookPage: 6,
    taskCount: 6,
    assignment: 'commander-distribution',
  },

  // ── Page 7 ────────────────────────────────────────────────────────────────
  {
    id: 25,
    sourceText:
      'Because of the reception dead spot you are hardly disturbed.',
    logbookPage: 7,
    taskCount: 6,
    communication: 'dead-zone',
  },
  {
    id: 26,
    sourceText: 'Two 1-value cards must win one trick each.',
    logbookPage: 7,
    taskCount: 6,
    constraints: [{ kind: 'win-value-count', value: 1, count: 2, distinct: true }],
  },
  {
    id: 27,
    sourceText: 'Your commander decides who will do the repair.',
    logbookPage: 7,
    taskCount: 3,
    assignment: 'commander-decision',
    optionalHandover: true,
  },
  {
    id: 28,
    sourceText: 'You may not communicate until the start of the 3rd trick.',
    logbookPage: 7,
    taskCount: 6,
    communication: { noCommUntilTrick: 3 },
  },
  {
    id: 29,
    sourceText:
      'At no time may a crew member have won 2 tricks more than another crew member. Communication is disrupted.',
    logbookPage: 7,
    taskCount: 6,
    constraints: [{ kind: 'balance', maxDiff: 1 }],
    communication: 'dead-zone',
  },
  {
    id: 30,
    sourceText: 'You are only allowed to communicate starting from the 2nd trick.',
    logbookPage: 7,
    taskCount: 6,
    communication: { noCommUntilTrick: 2 },
  },

  // ── Page 8 ────────────────────────────────────────────────────────────────
  {
    id: 31,
    sourceText:
      'As you slowly move away from Uranus, you receive a message from Earth requesting the collection of metadata of the Uranus moons.',
    logbookPage: 8,
    taskCount: 6,
  },
  {
    id: 32,
    sourceText:
      'Your Commander takes over the organization and distributes the individual orders.',
    logbookPage: 8,
    taskCount: 7,
    assignment: 'commander-distribution',
  },
  {
    id: 33,
    sourceText:
      'The selected crew member must win exactly 1 trick, but not with a Rocket card.',
    logbookPage: 8,
    taskCount: 0,
    constraints: [{ kind: 'player-trick-count', role: 'chosen', count: 1, rocketAllowed: false }],
    assignment: 'commander-decision',
  },
  {
    id: 34,
    sourceText:
      'At no time may a crew member have won 2 tricks more than another crew member. Your Commander must win the first and last trick.',
    logbookPage: 8,
    taskCount: 0,
    constraints: [
      { kind: 'balance', maxDiff: 1 },
      {
        kind: 'player-exact-tricks',
        role: 'commander',
        tricks: 'first-last',
        exclusive: false,
        rocketAllowed: true,
      },
    ],
  },
  {
    id: 35,
    sourceText:
      'The spacecraft Alpha 5 orbits Neptune, but has damaged sensors. Locate and repair them.',
    logbookPage: 8,
    taskCount: 7,
  },
  {
    id: 36,
    sourceText:
      'Your Commander distributes the individual orders.',
    logbookPage: 8,
    taskCount: 7,
    assignment: 'commander-distribution',
  },

  // ── Page 9 ────────────────────────────────────────────────────────────────
  {
    id: 37,
    sourceText: 'The Commander decides who takes care of it.',
    logbookPage: 9,
    taskCount: 8,
    assignment: 'commander-decision',
    optionalHandover: true,
  },
  {
    id: 38,
    sourceText: 'You are only allowed to communicate starting from the 3rd trick.',
    logbookPage: 9,
    taskCount: 8,
    communication: { noCommUntilTrick: 3 },
  },
  {
    id: 39,
    sourceText:
      'Recalibrate your instruments and find out what\'s really behind it.',
    logbookPage: 9,
    taskCount: 8,
    communication: 'dead-zone',
  },
  {
    id: 40,
    sourceText:
      'Before you start choosing the Order cards, you may place an Order tile on another order without an Order tile.',
    logbookPage: 9,
    taskCount: 8,
    // NOTE: The "place extra order tile" rule is a pre-selection setup option,
    // not a persistent constraint. Handled at the table before task assignment.
  },
  {
    id: 41,
    sourceText:
      'Your mission is that this person only wins the first and last trick. Since only the thrusters are used for position correction, both tricks may not be won with Rocket cards.',
    logbookPage: 9,
    taskCount: 0,
    constraints: [
      {
        kind: 'player-exact-tricks',
        role: 'chosen',
        tricks: 'first-last',
        exclusive: true,
        rocketAllowed: false,
      },
    ],
    assignment: 'commander-decision',
  },

  // ── Page 10 ───────────────────────────────────────────────────────────────
  {
    id: 42,
    sourceText:
      'The results allow only one conclusion: You have discovered a wormhole.',
    logbookPage: 10,
    taskCount: 9,
  },
  {
    id: 43,
    sourceText:
      'Your Commander secures the rest of the crew and distributes the individual orders.',
    logbookPage: 10,
    taskCount: 9,
    assignment: 'commander-distribution',
  },
  {
    id: 44,
    sourceText:
      'Each Rocket card must win a trick. First the 1-Rocket, then the 2, the 3 and finally the 4.',
    logbookPage: 10,
    taskCount: 0,
    constraints: [
      {
        kind: 'win-cards',
        cards: [
          { suit: 'rocket', value: 1 },
          { suit: 'rocket', value: 2 },
          { suit: 'rocket', value: 3 },
          { suit: 'rocket', value: 4 },
        ],
        ordered: true,
      },
    ],
  },
  {
    id: 45,
    sourceText:
      'You count them down – and suddenly burst out of the wormhole.',
    logbookPage: 10,
    taskCount: 9,
  },
  {
    id: 46,
    sourceText:
      'Your mission is for the crew member to the left of the one with the pink 9 to win all the pink cards. Declare who owns the pink 9.',
    logbookPage: 10,
    taskCount: 0,
    constraints: [{ kind: 'pink-left-sweep' }],
    // Role 'pink9holder' must be bound at setup via derivePink9Holder + assignRole.
  },
  {
    id: 47,
    sourceText:
      'You are at the end of your rope. The jump now feels like a prison in which you can no longer distinguish between reality and imagination.',
    logbookPage: 10,
    taskCount: 10,
  },

  // ── Page 11 ───────────────────────────────────────────────────────────────
  {
    id: 48,
    sourceText: 'The order must be won in the last trick.',
    logbookPage: 11,
    taskCount: 3,
    orderTokens: [{ kind: 'last' }],
    // LIMITATION: The Ω-order token is assigned to whichever task card draws the
    // "last" order token during setup — the specific card is unknown at data-encoding
    // time. A task-in-last-trick constraint with a fixed card cannot be encoded here.
    // Runtime card-binding is required to enforce this (future work).
  },
  {
    id: 49,
    sourceText:
      'You can go home! Check all 10 main modules, but pay special attention to life support, drive and communication. Set course for Earth.',
    logbookPage: 11,
    taskCount: 10,
  },
  {
    id: 50,
    sourceText:
      'A crew member must win the first 4 tricks. Another crew member must win the last trick. The remaining crew members must win all tricks in between. Your Commander asks everyone for his preferred task, then you decide together as a crew who should take over which position.',
    logbookPage: 11,
    taskCount: 0,
    constraints: [
      {
        kind: 'trick-partition',
        parts: [
          { role: 'first4', range: 'first4' },
          { role: 'last', range: 'last' },
          { role: 'middle', range: 'middle' },
        ],
      },
    ],
    assignment: 'open-pick',
    // Roles 'first4', 'last', and 'middle' must be bound at setup by crew negotiation.
  },
];
