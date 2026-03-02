import { FetcherResult } from '../fetchers/fetcher.types';
import { LLMMessage } from '../../services/ai/ai.service';

export const buildPrompt = (
  section: string,
  data: FetcherResult | null,
): LLMMessage[] => {
  const safeData = data?.data
    ? JSON.stringify(data.data)
    : 'No data available for this section.';

  const systemBase = `You are a hyper-concise neighborhood analyzer. 
You will receive raw JSON data for one specific category.
Generate exactly 1 to 2 sentences summarizing the meaning of this data for a prospective renter or homebuyer.
DO NOT use markdown. DO NOT use introductory phrases like "Based on the data". DO NOT hallucinate.
If the data says "No data available", reply with exactly: "Data is currently unavailable for this metric."`;

  let sectionRules = '';

  switch (section) {
    case 'rent':
      sectionRules =
        'Focus on the "price_zori" number. Explain if it seems affordable or high, relative to a general national baseline (~$1500-$2000).';
      break;
    case 'safety':
      sectionRules =
        'You will see a breakdown of crime incidents. Summarize the major types of crime and the overall volume of incidents gracefully.';
      break;
    case 'pois':
      sectionRules =
        'You will see a count of amenities (cafes, restaurants, etc). State the most prominent ones to paint a picture of the vibe.';
      break;
    case 'demographics':
      sectionRules =
        'You will see Total Households and Median Income. Translate those numbers into a brief description of the neighborhood scale and wealth level.';
      break;
    case 'transit':
      sectionRules =
        'You will see counts of bus and tram stops within 1km. Conclude if it seems highly walkable/transit-friendly or car-dependent.';
      break;
    case 'sentiment':
      sectionRules =
        'You will see 10 Reddit post excerpts. Synthesize the general sentiment or common complaints/praises of the locals.';
      break;
    case 'greenspace':
      sectionRules =
        'You will see counts of parks and nature reserves. State whether the area is urban dense or has good access to nature.';
      break;
    default:
      sectionRules = 'Summarize the provided JSON data briefly.';
  }

  return [
    {
      role: 'system',
      content: `${systemBase}\n\nRULES FOR THIS CATEGORY: ${sectionRules}`,
    },
    { role: 'user', content: safeData },
  ];
};
