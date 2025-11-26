const container = document.querySelector('.containerr');
const box = document.querySelector('.float-box-sh');


container.addEventListener('mousemove', (e) => {
const rect = container.getBoundingClientRect();
const mouseX = e.clientX - rect.left;
const mouseY = e.clientY - rect.top;


const xNorm = (mouseX / rect.width) * 2 - 1;
const yNorm = (mouseY / rect.height) * 2 - 1;


const moveStrength = 50;
const xMove = -xNorm * moveStrength;
const yMove = -yNorm * moveStrength;


box.style.transform = `translate(${xMove}px, ${yMove}px)`;
});


container.addEventListener('mouseleave', () => {
box.style.transform = `translate(0, 0)`;
});