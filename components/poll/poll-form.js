let t = TrelloPowerUp.iframe();
let pollQuestionInput = document.getElementById('poll_question');
let option1Input = document.getElementById('option_1');
let option2Input = document.getElementById('option_2');
let multipleVotesCheckbox = document.getElementById('multiple_votes');
let votersCanEditPollCheckbox = document.getElementById('voters_can_edit_poll');
let addOptionButton = document.getElementById('add_option');
let doneButton = document.getElementById('done');
let deleteButton = document.getElementById('delete');
let otherOptionsWrapper = document.getElementById('other_options_wrapper');
let optionsCounter = 0;

t.render(async function(){
    await t.member('all')
        .then(async function(me) {
            let currentPoll = t.arg("poll");
            if (currentPoll !== undefined) {
                pollQuestionInput.value = currentPoll.question;
                option1Input.value = currentPoll.options[0].value;
                option2Input.value = currentPoll.options[1].value;

                currentPoll.options.forEach(function(currentOption, index) {
                    if (index <= 1) {
                        return;
                    }
                    let option = generateOptionInput();
                    option.lastChild.value = currentOption.value;
                    otherOptionsWrapper.appendChild(option);
                });

                multipleVotesCheckbox.checked = currentPoll.multipleVotes;
                votersCanEditPollCheckbox.checked = currentPoll.votersCanEditPoll;
                doneButton.disabled = false;
                multipleVotesCheckbox.disabled = true;

                if (me.id !== currentPoll.author) {
                    votersCanEditPollCheckbox.disabled = true;
                }
            } else {
                deleteButton.parentNode.removeChild(deleteButton);
            }

            await t.sizeTo("#poll_form");
        });
});

deleteButton.addEventListener('click', function() {
    let currentPoll = t.arg('poll');
    if (currentPoll === undefined) {
        return;
    }
    // find poll
    t.get('card', 'shared', 'polls')
        .then(function(polls) {
            if (polls === undefined) {
                return;
            }
            let indexToDelete = -1;
            polls.forEach(function(poll, index) {
                if (poll.id === currentPoll.id) {
                    indexToDelete = index;
                }
            })
            if (indexToDelete >= 0) {
                polls.splice(indexToDelete, 1);
                t.set('card', 'shared', 'polls', polls)
                    .then(function() {
                        t.closePopup();
                    });
            }
        });
});

pollQuestionInput.addEventListener('input', function(evt) {
    doneButton.disabled = !(evt.target.value !== '' && option1Input.value !== '' && option2Input.value !== '');
});

option1Input.addEventListener('input', function(evt) {
    doneButton.disabled = !(evt.target.value !== '' && pollQuestionInput.value !== '' && option2Input.value !== '');
});

option2Input.addEventListener('input', function(evt) {
    doneButton.disabled = !(evt.target.value !== '' && pollQuestionInput.value !== '' && option1Input.value !== '');
});

addOptionButton.addEventListener('click', function() {
    let option = generateOptionInput();
    otherOptionsWrapper.appendChild(option);
    // ensure all nodes are named accordingly
    Array.from(otherOptionsWrapper.children).forEach(function (elem, i) {
        elem.lastChild.placeholder = `Option ${i + 3}`;
    })
    t.sizeTo("#poll_form");
});

let generateOptionInput = function() {
    let elemID = optionsCounter;
    optionsCounter++;

    let icon = document.createElement("span");
    icon.role = "img";
    icon.classList.add("input-icon");
    icon.classList.add("trash-icon");
    icon.addEventListener('click', function() {
        deleteOption(`option_${elemID}_wrapper`);
    })

    let iconWrapper = document.createElement("div");
    iconWrapper.classList.add("trash-icon-wrapper");
    iconWrapper.appendChild(icon);

    let input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";

    let inputWrapper = document.createElement("div");
    inputWrapper.classList.add("input-wrapper");
    inputWrapper.id = `option_${elemID}_wrapper`;
    inputWrapper.appendChild(iconWrapper);
    inputWrapper.appendChild(input);
    return inputWrapper;
};

let deleteOption = function(id) {
    let option = document.getElementById(id);
    option.parentNode.removeChild(option);
    // ensure all nodes are named accordingly
    Array.from(otherOptionsWrapper.children).forEach(function (elem, i) {
        elem.lastChild.placeholder = `Option ${i + 3}`;
    })
    t.sizeTo("#poll_form");
};

let generateRandomID = function() {
    return Math.floor(Math.random() * 0xffffffff).toString(16);
};

let newEmptyPoll = function() {
    return {
        id: generateRandomID(),
        author: "",
        question: "",
        votersCount: 0,
        options: [],
        votersCanEditPoll: false,
        multipleVotes: false,
    };
}

let newEmptyOption = function() {
    return {
        id: generateRandomID(),
        value: "",
        voters: [],
    };
}

doneButton.addEventListener('click', function() {
    if (doneButton.disabled) {
        return;
    }

    // lookup latest versions of polls
    t.get('card', 'shared', 'polls')
        .then(function(polls) {
            t.member('all')
                .then(function(me) {

                    if (polls === undefined) {
                        polls = [];
                    }
                    let newPoll = t.arg('poll');
                    let existingPollIndex = -1;
                    if (newPoll === undefined) {
                        newPoll = newEmptyPoll();
                    } else {
                        polls.forEach(function (existingPoll, index) {
                            if (existingPoll.id === newPoll.id) {
                                existingPollIndex = index;
                            }
                        })
                    }

                    newPoll.question = pollQuestionInput.value;
                    if (me.id === newPoll.author || newPoll.author === '') {
                        newPoll.votersCanEditPoll = votersCanEditPollCheckbox.checked;
                    }
                    newPoll.multipleVotes = multipleVotesCheckbox.checked;
                    if (newPoll.options.length <= 1) {
                        newPoll.options = [newEmptyOption(), newEmptyOption()];
                    }
                    newPoll.options[0].value = option1Input.value;
                    newPoll.options[1].value = option2Input.value;
                    newPoll.options = newPoll.options.slice(0, otherOptionsWrapper.children.length + 2);

                    let toDelete = [];
                    Array.from(otherOptionsWrapper.children).forEach(function (elem, index) {
                        if (newPoll.options.length <= index + 2) {
                            newPoll.options.push(newEmptyOption());
                        }
                        newPoll.options[index + 2].value = elem.lastChild.value;
                        if (elem.lastChild.value === '') {
                            toDelete.unshift(index + 2);
                        }
                    })

                    // cleanup empty entries
                    toDelete.forEach(function (index) {
                        newPoll.options.splice(index, 1);
                    });

                    if (newPoll.author === "") {
                        newPoll.author = me.id;
                    }

                    if (existingPollIndex >= 0) {
                        polls[existingPollIndex] = newPoll;
                    } else {
                        polls.push(newPoll);
                    }

                    t.set('card', 'shared', 'polls', polls)
                        .then(function () {
                            if (existingPollIndex < 0) {
                                // reset fields
                                pollQuestionInput.value = '';
                                option1Input.value = '';
                                option2Input.value = '';
                                otherOptionsWrapper.innerHTML = '';
                                doneButton.disabled = true;
                                t.sizeTo("#poll_form");
                                t.closePopup();
                            }
                        });
                });

        });
});