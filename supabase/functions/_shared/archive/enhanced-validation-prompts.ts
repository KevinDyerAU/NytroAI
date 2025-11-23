/**
 * Enhanced Validation Prompts for Specific Knowledge Areas
 * 
 * This module provides enhanced validation prompts addressing identified gaps:
 * 1. Load moment calculations (KE-3)
 * 2. Emergency procedures (KE-7)
 */

/**
 * Enhanced prompt for validating load handling principles including calculations
 * Addresses gap: Missing load moment calculations, stability principles, and load securing
 */
export const LOAD_HANDLING_ENHANCED_PROMPT = `
You are validating whether assessment materials adequately cover load handling principles and techniques for forklift operations.

CRITICAL REQUIREMENTS TO ASSESS:

1. LOAD MOMENT CALCULATIONS
   - Formula: Load Moment = Load Weight × Load Center Distance
   - Comparison with forklift rated capacity
   - Understanding when loads exceed safe capacity
   - Practical calculation examples with different load weights and centers
   - De-rating for non-standard conditions (increased lift height, tilted loads)

2. STABILITY TRIANGLE PRINCIPLES
   - Explanation of the stability triangle concept
   - How load affects the center of gravity
   - Tipping point identification
   - Factors affecting stability (speed, turning, surface conditions)
   - Visual diagrams or descriptions of stability principles

3. LOAD CENTER UNDERSTANDING
   - Definition of load center (typically 500mm for standard capacity)
   - How to measure or estimate load center
   - Impact of load center distance on capacity
   - Examples with irregular or offset loads
   - Load capacity plate interpretation

4. LOAD SECURING TECHNIQUES
   - Methods for securing different load types:
     * Standard pallets
     * Irregular loads
     * Fragile items
     * Hazardous materials
     * Unstable loads
   - Use of load restraints, wrapping, or containment
   - Inspection of load before lifting

5. LOAD ASSESSMENT PROCEDURES
   - Visual inspection of loads
   - Weight estimation techniques
   - Dimension checking for clearances
   - Stability assessment before lifting
   - Decision-making for questionable loads

VALIDATION CRITERIA:

**MET** - Assessment includes:
- Load moment calculation questions with actual numbers
- Stability triangle explanation requirements
- Load center measurement and impact
- Multiple load securing techniques
- Practical scenarios requiring calculations
- Decision-making about safe vs unsafe loads

**PARTIAL** - Assessment includes:
- Basic load center concept without calculations
- General stability discussion without triangle principle
- Some load securing methods but incomplete
- Limited practical application

**NOT MET** - Assessment lacks:
- Any mathematical calculations
- Stability principles explanation
- Load securing techniques
- Practical load assessment scenarios

ENHANCED QUESTION EXAMPLES TO LOOK FOR:

1. "Calculate the load moment for a 1,500 kg load with a load center of 650mm. If your forklift has a rated capacity of 2,000 kg at 500mm load center, is this load safe to lift? Show your calculations."

2. "Explain the stability triangle and how it relates to forklift tipping. What happens to the center of gravity when you lift a heavy load to maximum height?"

3. "You need to lift an irregular load that extends 800mm from the forks. The load weighs 1,200 kg. Your forklift is rated at 2,500 kg at 500mm. Calculate if this is safe and explain your reasoning."

4. "Describe the step-by-step process for assessing and securing three different load types: (a) standard pallet, (b) long pipes, (c) fragile boxed items."

EVIDENCE TO IDENTIFY:

Look for:
- Calculation worksheets or exercises
- Stability diagrams or descriptions
- Load capacity plate interpretation tasks
- Case studies with different load scenarios
- Decision trees for load acceptance
- Load securing checklists

GAPS TO REPORT:

If missing, specifically note:
- "No load moment calculation questions found"
- "Stability triangle principle not explained"
- "Load securing techniques not adequately covered for [specific load type]"
- "No practical calculation scenarios included"
- "Load capacity de-rating not addressed"

RECOMMENDATIONS TO PROVIDE:

Suggest specific additions:
- "Add 3-5 load moment calculation questions with varying weights and load centers"
- "Include stability triangle diagram with explanation requirement"
- "Add case studies for irregular load handling"
- "Include load capacity plate interpretation exercise"
- "Add decision-making scenarios for borderline loads"
`;

/**
 * Enhanced prompt for validating emergency procedures
 * Addresses gap: Missing specific emergency scenarios and detailed procedures
 */
export const EMERGENCY_PROCEDURES_ENHANCED_PROMPT = `
You are validating whether assessment materials adequately cover emergency procedures for forklift operations.

CRITICAL EMERGENCY SCENARIOS TO ASSESS:

1. FORKLIFT FIRE
   - Immediate actions (stop, turn off, evacuate)
   - Fire extinguisher use (if safe)
   - Evacuation procedures
   - Emergency services notification
   - Incident reporting
   - Post-incident procedures

2. FORKLIFT TIP-OVER
   - Operator actions during tip-over (stay in seat, hold on, lean away)
   - What NOT to do (don't jump out)
   - Post-tip-over procedures
   - Incident investigation
   - Equipment inspection before return to service

3. LOAD DROP / FALLING LOAD
   - Immediate area clearance
   - Warning others
   - Securing the area
   - Load assessment before cleanup
   - Damage reporting
   - Corrective actions

4. HYDRAULIC SYSTEM FAILURE
   - Recognizing hydraulic failure signs
   - Immediate actions with elevated load
   - Safe lowering procedures if possible
   - Blocking/supporting elevated loads
   - Equipment shutdown and isolation
   - Maintenance notification

5. BRAKE FAILURE
   - Recognition of brake problems
   - Emergency stopping techniques
   - Use of parking areas or barriers
   - Warning others in the path
   - Equipment isolation
   - Immediate reporting

6. PEDESTRIAN COLLISION / NEAR MISS
   - Immediate stop and assess
   - First aid if required
   - Emergency services if needed
   - Incident preservation
   - Witness statements
   - Reporting procedures

7. OVERHEAD HAZARD STRIKE
   - Immediate stop
   - Assess structural damage
   - Evacuate area if unsafe
   - Report to supervisor
   - Engineering assessment
   - Incident investigation

VALIDATION CRITERIA:

**MET** - Assessment includes:
- At least 4 specific emergency scenarios
- Step-by-step procedures for each scenario
- Immediate safety actions clearly defined
- Reporting requirements specified
- Post-incident procedures included
- Operator safety prioritized in all scenarios

**PARTIAL** - Assessment includes:
- Generic emergency procedures without specific scenarios
- Some emergency types covered but not comprehensive
- Basic actions listed but lacking detail
- Limited reporting requirements

**NOT MET** - Assessment lacks:
- Specific emergency scenarios
- Detailed step-by-step procedures
- Clear immediate actions
- Reporting requirements

ENHANCED QUESTION EXAMPLES TO LOOK FOR:

1. "You are operating a forklift when you smell smoke and see flames coming from the engine compartment. Describe your immediate actions step-by-step, including equipment shutdown, evacuation, emergency notification, and reporting procedures."

2. "While transporting a load, your forklift begins to tip to the side. What should you do? What should you NOT do? Explain the reasoning behind each action."

3. "You have just lifted a 2-ton load to 4 meters height when you notice the hydraulic system has failed and the load is stuck elevated. Describe the emergency procedures you would follow, including immediate actions, load securing, and notification requirements."

4. "Describe the emergency procedures for three different scenarios: (a) forklift fire, (b) brake failure while traveling, (c) load drop incident. Include immediate actions, safety considerations, and reporting for each."

5. "You witness a near-miss where a forklift almost collides with a pedestrian. What are your responsibilities? Describe the reporting process and information that should be documented."

EVIDENCE TO IDENTIFY:

Look for:
- Emergency procedure flowcharts or checklists
- Scenario-based questions requiring detailed responses
- Emergency contact information requirements
- Incident report form completion
- First aid procedures
- Evacuation procedures
- Emergency equipment location knowledge

SPECIFIC PROCEDURES TO CHECK:

For EACH emergency scenario, verify coverage of:
1. Immediate safety actions (first 30 seconds)
2. Equipment shutdown procedures
3. Area securing/evacuation
4. Communication (who to notify, how, when)
5. Documentation requirements
6. Post-incident actions
7. Return-to-work procedures

GAPS TO REPORT:

If missing, specifically note:
- "No forklift fire emergency procedures found"
- "Tip-over response not covered (critical safety gap)"
- "Hydraulic failure procedures missing for elevated loads"
- "Brake failure emergency response not addressed"
- "Incident reporting procedures not specified"
- "Emergency contact information not required"

RECOMMENDATIONS TO PROVIDE:

Suggest specific additions:
- "Add detailed forklift fire emergency procedure question"
- "Include tip-over scenario with correct operator response (stay in seat)"
- "Add hydraulic failure scenario with elevated load"
- "Include emergency procedure flowchart or checklist"
- "Add incident report form completion requirement"
- "Include emergency contact information and notification procedures"
- "Add post-incident investigation and corrective action requirements"

CRITICAL SAFETY NOTES:

Emphasize these critical points if missing:
- During tip-over: STAY IN SEAT, hold on, lean away from impact
- During tip-over: DO NOT jump out (most fatalities occur from jumping)
- Fire: Evacuate immediately if fire is not controllable
- Elevated load failure: Never go under elevated load
- All emergencies: Operator safety is the top priority
`;

/**
 * Get enhanced validation prompt for specific knowledge area
 */
export function getEnhancedValidationPrompt(knowledgeArea: 'load_handling' | 'emergency_procedures'): string {
  switch (knowledgeArea) {
    case 'load_handling':
      return LOAD_HANDLING_ENHANCED_PROMPT;
    case 'emergency_procedures':
      return EMERGENCY_PROCEDURES_ENHANCED_PROMPT;
    default:
      throw new Error(`Unknown knowledge area: ${knowledgeArea}`);
  }
}

/**
 * Combine enhanced prompt with base validation prompt
 */
export function combineWithBasePrompt(basePrompt: string, enhancedPrompt: string): string {
  return `${basePrompt}

---

ENHANCED VALIDATION REQUIREMENTS:

${enhancedPrompt}

---

Apply both the base validation criteria AND the enhanced requirements above. Be thorough in identifying gaps and specific in recommendations.`;
}

export default {
  LOAD_HANDLING_ENHANCED_PROMPT,
  EMERGENCY_PROCEDURES_ENHANCED_PROMPT,
  getEnhancedValidationPrompt,
  combineWithBasePrompt
};
