// All displayed responses are independently specified by the reviewed authoring groups.
import {chapterSixTasteResponses} from './busuu-chapter-six-taste-responses.mjs';
import {chapterSixEmphasisResponses} from './busuu-chapter-six-emphasis-responses.mjs';
import {chapterSixRailResponses,chapterSixRailAction} from './busuu-chapter-six-rail-responses.mjs';
export const chapterSixResponses={...chapterSixTasteResponses,...chapterSixEmphasisResponses,...chapterSixRailResponses};
export const chapterSixAction=chapterSixRailAction;
