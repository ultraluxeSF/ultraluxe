// Slideshow script is adapted from https://www.w3schools.com/howto/howto_js_slideshow.asp
var slideNumber = 1;
showSlide(slideNumber);

// if Previous button is clicked, then n = -1
// if Next button is clicked, then n = 1
function switchSlide(n) {
  showSlide(slideNumber += n);
}

// show slide with number n
function showSlide(n) {
  var slides = document.getElementsByClassName("slide");  // find all the slides and store them in array variable
  var dots = document.getElementsByClassName("dot");      // find all the dots and store them in array variable

  // if n is more than the number of slides, then set slideNumber to 1
  if (n > slides.length) {slideNumber = 1;}


  // else, if n is less than 1, then set slideNumber to the number of the last slide
  else if (n < 1) {slideNumber = slides.length;}

  // if none of the conditions above are true, then slideNumber should be equal to n (anything from 1 to 3 inclusively)
  else {slideNumber = n;}

  // this is a loop, which goes through all the slides and adds inline styling to each of them:
  // the following style attribute will be added to each .slide: style="display: none;"
  for (var i = 0; i < slides.length; i++) {
      slides[i].style.display = "none";
  }

  // another loop, which goes through all the dots and removes .active class from all of them by replacing it with empty string
  for (i = 0; i < dots.length; i++) {
      dots[i].className = dots[i].className.replace(" active", "");
  }


  // all slides and dots stored inside arrays can be accessed using index, which is zero-based
  // i.e., slides[0] is the first slide; slide[1] is the 2nd; slide[2] is the 3rd
  // same thing for dots – the index equals to slide/dot number minus 1
  slides[slideNumber-1].style.display = "block";  // display the current slide (all of them were hidden before)
  dots[slideNumber-1].className += " active";     // add .active class to current dot
}

var rellax = new Rellax('.rellax');
