import { getMember } from "../../service/api.js";
import { resetCardSectionHeight } from "../card-section/card-section.js";

let t = TrelloPowerUp.iframe();
var Promise = TrelloPowerUp.Promise;
let pollsSection = document.getElementById('polls_section');
let pollSectionWrapper = document.getElementById('polls_section_wrapper');
let pollSectionHeaderButton = document.getElementById('polls_section_header_button');

let hidePollSection = function() {
    pollSectionWrapper.style.display = 'none';
}

let showPollSection = function() {
    pollSectionWrapper.style.display = 'block';
}

export const renderPollSection = function(){
    return new Promise(function(resolve) {
        t.get('card', 'shared', 'polls')
            .then(function (polls) {
                t.member('all')
                    .then(function (me) {
                        if (polls === undefined || polls.length === 0) {
                            hidePollSection();
                            resolve();
                            return;
                        } else if (polls.length > 0) {
                            showPollSection();
                        }

                        // start by updating existing polls
                        polls.forEach(function (poll) {
                            let pollNode = document.getElementById(poll.id);
                            if (pollNode == null) {
                                pollNode = generatePollNode(poll.id);
                                pollsSection.appendChild(pollNode);
                            }
                            pollNode.firstChild.firstChild.firstChild.innerText = poll.question;
                            getMember(t, poll.author)
                                .then(function (member) {
                                    if (member !== undefined) {
                                        pollNode.firstChild.firstChild.lastChild.innerText = `created by ${member.fullName}, ${poll.votersCount} vote(s)`;
                                    }
                                });
                            if (!poll.votersCanEditPoll && poll.author !== me.id) {
                                pollNode.firstChild.lastChild.disabled = true;
                            }
                            pollNode.firstChild.lastChild.addEventListener('click', function (evt) {
                                if (pollNode.firstChild.lastChild.disabled === true) {
                                    return;
                                }
                                t.popup({
                                    title: 'Edit poll',
                                    url: '../poll/poll-form.html',
                                    height: 284,
                                    args: {
                                        poll: poll,
                                    },
                                    mouseEvent: evt,
                                });
                            });

                            // update options
                            poll.options.forEach(function (option) {
                                let optionNode = document.getElementById(option.id);
                                if (optionNode == null) {
                                    optionNode = generatePollCase(option.id);
                                    pollNode.appendChild(optionNode);
                                }
                                optionNode.title = `${option.voters.length} votes`;
                                let percentage = 0;
                                if (poll.votersCount > 0) {
                                    percentage = Math.floor((option.voters.length / poll.votersCount) * 100);
                                }
                                optionNode.style.background = `linear-gradient(90deg, #c6e4ff ${percentage}%, #f4f5f700 0%)`;
                                optionNode.firstChild.innerHTML = `${option.value}<input type="checkbox"><span class="checkmark"></span>`;
                                optionNode.firstChild.childNodes[1].addEventListener('click', updateVote(poll, option, me));

                                // update voters
                                option.voters.forEach(function (voter) {
                                    if (voter === me.id) {
                                        optionNode.firstChild.childNodes[1].checked = true;
                                    }

                                    let voterIcon = document.getElementById(option.id + voter);
                                    if (voterIcon == null) {
                                        voterIcon = generateVoterIcon(option.id + voter);
                                        optionNode.lastChild.appendChild(voterIcon);
                                    }

                                    getMember(t, voter)
                                        .then(function (member) {
                                            if (member !== undefined) {
                                                voterIcon.src = `${member.avatarUrl}/50.png`;
                                                resetCardSectionHeight();
                                            }
                                        });
                                });

                                Array.from(optionNode.lastChild.childNodes).forEach(function (voterIcon) {
                                    let voterCandidate = voterIcon.id.substring(option.id.length);
                                    let found = false;
                                    option.voters.forEach(function (voter) {
                                        if (voterCandidate === voter) {
                                            found = true;
                                        }
                                    });
                                    if (!found) {
                                        voterIcon.parentNode.removeChild(voterIcon);
                                    }
                                });
                            });

                            Array.from(pollNode.childNodes).slice(1).forEach(function (optionNode, index) {
                                let found = false;
                                poll.options.forEach(function (option) {
                                    if (option.id === optionNode.id) {
                                        found = true;
                                    }
                                })
                                if (!found) {
                                    optionNode.parentNode.removeChild(optionNode);
                                }
                            })
                        });

                        Array.from(pollsSection.children).forEach(function (pollNode) {
                            let found = false;
                            polls.forEach(function (poll) {
                                if (poll.id === pollNode.id) {
                                    found = true;
                                }
                            });
                            if (!found) {
                                pollNode.parentNode.removeChild(pollNode);
                            }
                        });

                        resolve();
                    });
            });
    });
};

let generatePollNode = function(id) {
    // <div id="56513165">
    //     <div class="poll-header">
    //         <div>
    //             <h3>This is the first poll question ?</h3>
    //             <em>created by Peter, 423 votes</em>
    //         </div>
    //         <button>
    //             <div className="pen-icon"></div>
    //         </button>
    //     </div>
    // </div>
    let node = document.createElement("div");
    node.id = id;
    node.classList.add("poll-wrapper");

    let header = document.createElement("div");
    header.classList.add("poll-header");
    header.appendChild(document.createElement("div"));
    header.firstChild.appendChild(document.createElement("h3"));
    header.firstChild.appendChild(document.createElement("em"));
    let button = document.createElement("button");
    let buttonIcon = document.createElement("div");
    buttonIcon.classList.add("pen-to-square-icon");
    button.appendChild(buttonIcon);
    header.appendChild(button);

    node.appendChild(header);
    return node
};

let generatePollCase = function(id) {
    // <div class="poll-case input-checkbox input-wrapper" title="165 votes" style="background: linear-gradient(90deg, #c6e4ff 88%, #f4f5f700 0%);">
    //     <label class="poll-label input-checkbox-container">Voters are allowed to choose
    //         <input type="checkbox" checked>
    //             <span class="checkmark"></span>
    //     </label>
    //     <div>
    //         <img class="profile-icon" src="https://trello-members.s3.amazonaws.com/63637a4a19d3ab0274662fc1/fcd5f66926b503d050814724cda6cb7a/170.png">
    //     </div>
    // </div>
    let pollCase = document.createElement("div");
    pollCase.id = id;
    pollCase.classList.add("poll-case", "input-checkbox", "input-wrapper");

    let caseLabel = document.createElement("label");
    caseLabel.classList.add("poll-label", "input-checkbox-container");
    pollCase.appendChild(caseLabel);
    pollCase.appendChild(document.createElement("div"));
    return pollCase;
}

let generateVoterIcon = function(id) {
    let icon = document.createElement("img");
    icon.id = id;
    icon.classList.add("profile-icon");
    return icon;
}

let updateVote = function(clickedPoll, clickedOption, me) {
    return function(clickEvent) {
        t.get('card', 'shared', 'polls')
            .then(function(polls) {
                // find and update the correct poll
                polls.forEach(function(poll, pollIndex) {
                    if (poll.id === clickedPoll.id) {
                        poll.options.forEach(function(option, optionIndex) {
                            if (!clickedPoll.multipleVotes || (clickedPoll.multipleVotes && option.id === clickedOption.id)) {
                                // cleanup vote
                                polls[pollIndex].options[optionIndex].voters = polls[pollIndex].options[optionIndex].voters.filter(function(voter) {
                                    return voter !== me.id;
                                });
                            }
                            if (option.id === clickedOption.id) {
                                // cleanup vote
                                polls[pollIndex].options[optionIndex].voters = polls[pollIndex].options[optionIndex].voters.filter(function(voter) {
                                    return voter !== me.id;
                                });
                                if (clickEvent.target.checked) {
                                    // add vote
                                    polls[pollIndex].options[optionIndex].voters.push(me.id);
                                }
                            }
                        });

                        // compute new voters count
                        let voters = [];
                        poll.options.forEach(function(option, optionIndex) {
                            option.voters.forEach(function(voter) {
                                let shouldAppend = true;
                                voters.forEach(function(existingVoter) {
                                    if (existingVoter === voter) {
                                        shouldAppend = false;
                                    }
                                });
                                if (shouldAppend) {
                                    voters.push(voter);
                                }
                            })
                        });
                        polls[pollIndex].votersCount = voters.length;
                    }
                });

                t.set('card', 'shared', 'polls', polls);
            });
    }
}

pollSectionHeaderButton.addEventListener('click', function(evt) {
    t.popup({
        title: 'Add a poll',
        url: '../poll/poll-form.html',
        height: 284,
        mouseEvent: evt,
    });
});