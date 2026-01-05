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
// @grant       GM.xmlHttpRequest
// @grant       unsafeWindow
// @version     18
// ==/UserScript==


/* jshint esversion: 11, browser: true */
/* globals WaitForElements */

(async () => {

"use strict";


function getPuzzleISODate()
{
    let isoDate = unsafeWindow?.gameData?.today?.printDate;

    if (!isoDate)
        throw Error("failed to get date for this puzzle");

    return isoDate;
}


function getDateParts(isoDateStr)
{
    let [year, month, day] = isoDateStr.split("-");
    return {year, month, day};
}


function getDateWithDelimiter(dateParts, delim)
{
    return [ dateParts.year, dateParts.month.padStart(2, "0"), dateParts.day.padStart(2, "0")].join(delim);
}


async function fetcher(opts)
{
    return new Promise((res, rej) => {
        opts.headers = opts.headers || {};
        opts.headers.Accept = opts.headers.Accept || "*/*";
        opts.method = opts.method || "GET";
        opts.onload = response => {
            if (response.status >= 200 && response.status < 300)
            {
                res(response);
            }
            else
            {
                rej({
                    status: response.status,
                    statusText: `${response.status} ${response.statusText} retrieving ${opts.url}`
                });
            }
        };
        opts.onerror = response => {
            rej({
                status: response.status,
                statusText: `${response.status} ${response.statusText} retrieving ${opts.url}`
            });

        };

        return GM.xmlHttpRequest(opts);
    });
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


async function fetchHintInfo(isoPuzzleDateStr)
{
    let dateParts = getDateParts(isoPuzzleDateStr);
    let url = new URL(`Bee_${getDateWithDelimiter(dateParts, "")}.html`, "https://nytbee.com/");

    let response = await fetcher({
        url: url,
        responseType: "document",
    });

    let doc = response.response;
    let wordStats = {};
    let puzzleNotes = Array.from(doc.querySelectorAll("#puzzle-notes > h3"));

    if (puzzleNotes.length === 0)
        throw Error("Failed to find hint info notes");

    for (let $el of Array.from(doc.querySelectorAll("#puzzle-notes > h3")))
    {
        let num = ($el.innerText.match(/number of pangrams:\s*(\d+)/i) ?? [])[1];
        if (num > 0)
            wordStats.numberOfPangrams = parseInt(num, 10);

        num = ($el.innerText.match(/maximum puzzle score:\s*(\d+)/i) ?? [])[1];
        if (num > 0)
            wordStats.maxScore = parseInt(num, 10);

        num = ($el.innerText.match(/number of answers:\s*(\d+)/i) ?? [])[1];
        if (num > 0)
            wordStats.numAnswers = parseInt(num, 10);

        num = ($el.innerText.match(/points needed for genius:\s*(\d+)/i) ?? [])[1];
        if (num > 0)
            wordStats.pointsGenius = parseInt(num, 10);
    }

    let twoLetter2Count = {};
    let $mainAnswerList = doc.querySelector("#main-answer-list");

    if (!$mainAnswerList)
        throw Error("failed to find #main-answer-list");

    let wordlist = Array.from($mainAnswerList
        .querySelectorAll('.flex-list-item'))
        .map($el => $el.innerText.replaceAll(/\W+/g, ""));
    let perfectPangramList = Array.from($mainAnswerList
        .querySelectorAll('.flex-list-item mark'))    // pangrams are marked
        .map($el => $el.innerText.replaceAll(/\W+/g, ""))
        .filter(el => isEachLetterUsedOnce(el));

    if (wordlist.length === 0)
        throw Error("found no words in hint data");

    for (let w of wordlist)
    {
        let twoLetterPrefix = w.substring(0, 2).toUpperCase();
        twoLetter2Count[twoLetterPrefix] = (twoLetter2Count[twoLetterPrefix] ?? 0) + 1;
    }

    wordStats.perfectPangramList = perfectPangramList;

    return {
        wordStats,
        twoLetter2Count
    };
}


function buildPrefixCountElement(words, forumInfo)
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
        <span id="_pangramcount">Number of Pangrams: ${forumInfo.wordStats.numberOfPangrams}` +
        (forumInfo.wordStats.perfectPangramList.length > 0 ?
            ` <span id="_perfectpangramcount">(${forumInfo.wordStats.perfectPangramList.length} perfect)</span>` :
            "") +
        "</span><br>" +
        `Maximum Puzzle Score: ${forumInfo.wordStats.maxScore}<br>
        Number of Answers: ${forumInfo.wordStats.numAnswers}<br>
        Points Needed for Genius: ${forumInfo.wordStats.pointsGenius}`;
    $outer.append($wordStats);

    let pangramsFound = Array.from(document.querySelectorAll(".sb-wordlist-window .sb-anagram.pangram")).map(el => el.innerText.trim().toLowerCase());
    let perfectPangramsFound = pangramsFound.filter(word => isEachLetterUsedOnce(word));

    if (pangramsFound.length === forumInfo.wordStats.numberOfPangrams)
        $wordStats.querySelector("#_pangramcount").classList.add("sb-extras-done");

    if (forumInfo.wordStats.perfectPangramList.length > 0 && perfectPangramsFound.length === forumInfo.wordStats.perfectPangramList.length)
        $wordStats.querySelector("#_perfectpangramcount").classList.add("sb-extras-done");


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
    let needPairs = Object.keys(forumInfo.twoLetter2Count);
    needPairs.sort();

    for (let p of needPairs)
    {
        let $tr = $tb.insertRow();
        $el = $tr.insertCell();
        $el.innerText = p;
        $el = $tr.insertCell();
        let needCount = forumInfo.twoLetter2Count[p];
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
    for (let $li of document.querySelectorAll(".sb-wordlist-window li"))
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


function update(forumInfo)
{
    let words = getFoundWords();
    let $el = buildPrefixCountElement(words, forumInfo);
    displayCounts($el);
}


async function main()
{
    let isoPuzzleDateStr = getPuzzleISODate();

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
        background-color: #dcffdc;
    }

    .sb-extras-wordstats {
        padding-bottom:  1ex;
    }
    `);

    let forumInfo = await fetchHintInfo(isoPuzzleDateStr);

    let waiter = new WaitForElements({
        selectors: [ ".hive" ],
        filter: ($els) => $els.filter($el => $el.checkVisibility()),
        allowMultipleMatches: true,
    });

    waiter.match(() => update(forumInfo));
}

try {
    await main();
}

catch (e) {
    window.alert(`Greasemonkey script ${GM.info.script.name}: ${e.message}`);
    throw e;
}

})();
