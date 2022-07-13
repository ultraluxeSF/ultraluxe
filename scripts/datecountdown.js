// Graphic Design

let thisYear = new Date().getFullYear();
let gdYear = '2017';
let gdDate = new Date("01 Jul 2017");
let currentDate = new Date();

var gdDifference = currentDate - gdDate;

document.querySelector("#xp-GD-difference").textContent = Math.trunc(gdDifference/(1000 * 3600 * 24));
document.querySelector("#xp-GD-years").textContent = thisYear - gdYear;

// UI/UX

let uiYear = '2021';
let uiDate = new Date("28 Jun 2021");

var uiDifference = currentDate - uiDate;

document.querySelector("#xp-UI-difference").textContent = Math.trunc(uiDifference/(1000 * 3600 * 24));
document.querySelector("#xp-UI-years").textContent = thisYear - uiYear;
