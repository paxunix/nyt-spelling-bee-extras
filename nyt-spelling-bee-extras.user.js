// ==UserScript==
// @name        Spelling Bee Extras
// @namespace   paxunix@gmail.com
// @match       https://www.nytimes.com/puzzles/spelling-bee/*
// @match       https://www.nytimes.com/puzzles/spelling-bee
// @match       https://www.nytimes.com/puzzles/spelling-bee?*
// @downloadURL https://raw.githubusercontent.com/paxunix/nyt-spelling-bee-extras/main/nyt-spelling-bee-extras.user.js
// @updateURL   https://raw.githubusercontent.com/paxunix/nyt-spelling-bee-extras/main/nyt-spelling-bee-extras.user.js
// @require     https://cdn.jsdelivr.net/gh/paxunix/WaitForElements/WaitForElements.min.js
// @grant       GM.addStyle
// @grant       unsafeWindow
// @grant       GM.registerMenuCommand
// @version     27
// ==/UserScript==


/* jshint esversion: 11, browser: true */
/* globals WaitForElements */

(async () => {

"use strict";

const doneBackgroundColor = "#dcffdc";
const longWordBackgroundColor = "#46f8f9";


function navTo(curIsoDateStr, numDays)
{
    let [year, month, day] = curIsoDateStr.split("-");
    let curDateObj = new Date(year, month - 1, day);
    let toDateObj = new Date(curDateObj.getTime());
    toDateObj.setDate(toDateObj.getDate() + numDays);

    const toPuzzleDate = toDateObj.toISOString().split("T")[0];

    window.location = `https://www.nytimes.com/puzzles/spelling-bee/${toPuzzleDate}`;
}


function isEachLetterUsedOnce(word)
{
    let o = {};
    for (let letter of word.split(""))
    {
        o[letter] = (o[letter] ?? 0) + 1;
    }

    return Object.values(o).filter(el => el > 1).length === 0;
}


function getPuzzleData()
{
    return unsafeWindow?.gameData?.today ?? {};
}


function requirePuzzleData()
{
    let puzzleData = getPuzzleData();

    if (!puzzleData.printDate || !Array.isArray(puzzleData.answers) || !Array.isArray(puzzleData.pangrams))
    {
        throw Error("failed to get puzzle data");
    }

    return puzzleData;
}


function buildHintInfo(puzzleData)
{
    let twoLetter2Count = {};

    for (let w of puzzleData.answers)
    {
        let twoLetterPrefix = w.substring(0, 2).toUpperCase();
        twoLetter2Count[twoLetterPrefix] = (twoLetter2Count[twoLetterPrefix] ?? 0) + 1;
    }

    return {
        wordStats: {
            numberOfPangrams: puzzleData.pangrams.length,
            numAnswers: puzzleData.answers.length,
            perfectPangramList: puzzleData.pangrams.filter(isEachLetterUsedOnce),
            longWordList: puzzleData.answers.filter(word => word.length >= 10),
        },
        twoLetter2Count
    };
}


function buildPrefixCountElement(words, hintInfo)
{
    let prefix2Count = {};
    for (let w of words)
    {
        let prefix = w.substr(0, 2).toUpperCase();
        prefix2Count[prefix] = (prefix2Count[prefix] ?? 0) + 1;
    }

    let $outer = document.createElement("div");
    let $wordStats = document.createElement("div");
    $wordStats.classList.add("sb-extras-wordstats");
    $wordStats.innerHTML = `
        <span id="_pangramcount">Number of Pangrams: ${hintInfo.wordStats.numberOfPangrams}` +
        (hintInfo.wordStats.perfectPangramList.length > 0 ?
            ` <span id="_perfectpangramcount">(${hintInfo.wordStats.perfectPangramList.length} perfect)</span>` :
            "") +
        "</span><br>" +
        `<span id="_longwordcount">Number of Long Words: ${hintInfo.wordStats.longWordList.length}</span><br>` +
        `Number of Answers: ${hintInfo.wordStats.numAnswers}`;
    $outer.append($wordStats);

    let pangramsFound = Array.from(document.querySelectorAll(".sb-wordlist-window .sb-anagram.pangram")).map(el => el.innerText.trim().toLowerCase());
    let perfectPangramsFound = pangramsFound.filter(word => isEachLetterUsedOnce(word));
    let longWordsFound = words.filter(word => word.length >= 10);

    if (pangramsFound.length === hintInfo.wordStats.numberOfPangrams)
        $wordStats.querySelector("#_pangramcount").classList.add("sb-extras-done");

    if (hintInfo.wordStats.perfectPangramList.length > 0 && perfectPangramsFound.length === hintInfo.wordStats.perfectPangramList.length)
        $wordStats.querySelector("#_perfectpangramcount").classList.add("sb-extras-done");

    if (hintInfo.wordStats.longWordList.length > 0 && longWordsFound.length === hintInfo.wordStats.longWordList.length)
        $wordStats.querySelector("#_longwordcount").classList.add("sb-extras-long-word-done");


    let $wrapper = document.createElement("table");
    $wrapper.style = "width: 100%;";
    $outer.append($wrapper);

    let $th = $wrapper.createTHead();
    let $thr = $th.insertRow();
    let $el = $thr.insertCell();
    $el.innerText = "Pair";
    $el = $thr.insertCell();
    $el.innerText = "# Need";
    $el = $thr.insertCell();
    $el.innerText = "# Got";

    let $tb = $wrapper.createTBody();
    let needPairs = Object.keys(hintInfo.twoLetter2Count);
    needPairs.sort();

    for (let p of needPairs)
    {
        let $tr = $tb.insertRow();
        $el = $tr.insertCell();
        $el.innerText = p;
        $el = $tr.insertCell();
        let needCount = hintInfo.twoLetter2Count[p];
        $el.innerText = needCount;
        $el = $tr.insertCell();
        let gotCount = prefix2Count[p] ?? 0;
        $el.innerText = gotCount;

        if (needCount == gotCount)
            $tr.classList.add("sb-extras-done");
    }

    return $outer;
}


function getFoundWords()
{
    let words = [];
    for (let $li of document.querySelectorAll(".sb-wordlist-window span.sb-anagram"))
    {
        words.push($li.innerText.trim());
    }

    return words;
}


function displayCounts($el)
{
    $el.id = "sb-extras";

    let $curdiv = document.querySelector(`#${$el.id}`);
    if ($curdiv === null)
        document.querySelector("#pz-game-root")
            .insertAdjacentElement("afterbegin", $el);
    else
        $curdiv.replaceWith($el);
}


function update(hintInfo)
{
    let words = getFoundWords();
    let $el = buildPrefixCountElement(words, hintInfo);
    displayCounts($el);
}


function wordStyleClass($el)
{
    return Array.from($el.classList).find(className => className.startsWith("sb-extras-word-style-")) ?? "";
}


function getWordStyleElement($wordEl)
{
    return $wordEl.closest("li") ?? $wordEl;
}


function styleFoundWords($els)
{
    let puzzleData = getPuzzleData();
    let solutionWords = new Set((puzzleData.answers ?? []).map(word => word.toLowerCase()));
    let pangramWords = new Set((puzzleData.pangrams ?? []).map(word => word.toLowerCase()));

    for (let $el of $els)
    {
        let $styleEl = getWordStyleElement($el);
        let word = $el.textContent.trim().toLowerCase();
        let isLongSolutionWord = solutionWords.has(word) && word.length >= 10;
        let isPangram = pangramWords.has(word);
        let isPerfectPangram = isPangram && isEachLetterUsedOnce(word);
        let newStyleClass = "sb-extras-word-style-none";
        let titleText = "";

        $styleEl.classList.remove(
            "sb-extras-word-style-long-solution",
            "sb-extras-word-style-pangram",
            "sb-extras-word-style-long-pangram",
            "sb-extras-word-style-none"
        );

        if (isPangram && isLongSolutionWord && !isPerfectPangram)
        {
            newStyleClass = "sb-extras-word-style-long-pangram";
            titleText = "Long non-perfect pangram";
        }
        else if (isPangram)
        {
            newStyleClass = "sb-extras-word-style-pangram";
            titleText = isPerfectPangram ? "Perfect pangram" : "Pangram";
        }
        else if (isLongSolutionWord)
        {
            newStyleClass = "sb-extras-word-style-long-solution";
            titleText = "Long solution word";
        }

        $styleEl.classList.add(newStyleClass);
        $styleEl.title = titleText;
    }
}


async function main()
{
    let puzzleData = requirePuzzleData();
    let isoPuzzleDateStr = puzzleData.printDate;

    GM.registerMenuCommand("Previous puzzle", () => { navTo(isoPuzzleDateStr, -1) });
    GM.registerMenuCommand("Next puzzle", () => { navTo(isoPuzzleDateStr, +1) });

    GM.addStyle(`
    #sb-extras {
        position: absolute;
        left: 5em;
        top: 10ex;
        font-family: monospace;
        font-size: 3ex;
        max-width: 20em;
        min-width: 16em;
        text-align: center;
    }

    #sb-extras thead {
        font-weight: bold;
    }

    #sb-extras tr {
        border-bottom-style: dashed;
        border-bottom-width: thin;
        border-bottom-color: lightgrey;
        padding-top: 0.3ex;
        padding-bottom: 0.3ex;
    }

    .sb-extras-done {
        background-color: ${doneBackgroundColor};
    }

    .sb-extras-long-word-done {
        background-color: ${longWordBackgroundColor};
    }

    .sb-extras-wordstats {
        padding-bottom:  1ex;
    }

    .sb-status-box li.sb-extras-word-style-long-solution {
        background: ${longWordBackgroundColor} !important;
    }

    .sb-status-box li.sb-extras-word-style-pangram {
        background: ${doneBackgroundColor} !important;
    }

    .sb-status-box li.sb-extras-word-style-long-pangram {
        background: linear-gradient(to bottom right, ${doneBackgroundColor} 50%, ${longWordBackgroundColor} 50%) !important;
    }
    `);

    let waiter = new WaitForElements({
        selectors: [ ".hive" ],
        filter: ($els) => $els.filter($el => $el.checkVisibility()),
        allowMultipleMatches: true,
    });

    let foundWordWaiter = new WaitForElements({
        selectors: [ ".sb-status-box .sb-anagram" ],
        filter: ($els) => $els.filter($el => $el.checkVisibility() && wordStyleClass(getWordStyleElement($el)) === ""),
        allowMultipleMatches: true,
    });

    await waiter.match();
    let hintInfo = buildHintInfo(puzzleData);

    update(hintInfo);

    foundWordWaiter.match(($els) => {
        styleFoundWords($els);
        update(hintInfo);
    });
}

try {
    await main();
}

catch (e) {
    window.alert(`Greasemonkey script ${GM.info.script.name}: ${e.message}`);
    throw e;
}

})();
