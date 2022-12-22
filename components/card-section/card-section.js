import { renderLocationSection } from '../location/location-card-section.js';
import { renderPollSection } from "../poll/poll-card-section.js";
import { shouldShowCardSection } from "../../service/sections.js";
import { renderContactSection } from "../contacts/contact-card-section.js";

let t = TrelloPowerUp.iframe();
var Promise = TrelloPowerUp.Promise;

export const resetCardSectionHeight = function() {
    return shouldShowCardSection(t)
        .then(function(yes) {
            if (yes) {
                t.sizeTo("#card_section_wrapper").catch(function() {
                    t.sizeTo(1).catch(function() {});
                });
            } else {
                t.sizeTo(1).catch(function() {});
            }
        });
};

t.render(async function(){
    await Promise.all([
        renderContactSection(),
        renderPollSection(),
        renderLocationSection(),
    ]);

    return resetCardSectionHeight();
});