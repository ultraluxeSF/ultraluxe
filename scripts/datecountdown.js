// Graphic Design

let thisYear = new Date().getFullYear();
let gdYear = '2016';
let gdDate = new Date("01 Jul 2016");
let currentDate = new Date();

var gdDifference = currentDate - gdDate;

document.querySelector("#xp-GD-difference").textContent = Math.trunc(gdDifference/(1000 * 3600 * 24));
document.querySelector("#xp-GD-yearss").textContent = thisYear - gdYear;

// UI/UX

let uiYear = '2021';
let uiDate = new Date("04 March 2021");

var uiDifference = currentDate - uiDate;

document.querySelector("#xp-UI-difference").textContent = Math.trunc(uiDifference/(1000 * 3600 * 24));
document.querySelector("#xp-UI-yearss").textContent = thisYear - uiYear;
