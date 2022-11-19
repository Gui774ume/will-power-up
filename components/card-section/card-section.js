import { renderLocationSection } from '../location/location-card-section.js';
import { renderPollSection } from "../poll/poll-card-section.js";
import { shouldShowCardSection } from "../../service/sections.js";

let t = TrelloPowerUp.iframe();

export const resetCardSectionHeight = function() {
    shouldShowCardSection(t)
        .then(function(yes) {
            if (yes) {
                t.sizeTo("#card_section_wrapper");
            } else {
                t.sizeTo(1);
            }
        });
};

t.render(function(){
    renderLocationSection()
        .then(function () {
            renderPollSection()
                .then(function () {
                    resetCardSectionHeight();
                });
        });
});