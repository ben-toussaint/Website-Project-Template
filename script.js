
/*function initNav() {
    const menuButton = document.getElementById('menu-btn');
    const closeButton = document.getElementById('close-btn');
    const mobileNav = document.getElementById('mobile-nav');

    menuButton.addEventListener('click', () => {
        mobileNav.classList.remove('hidden');
        mobileNav.classList.add('flex');
        menuButton.classList.add('hidden');
        closeButton.classList.remove('hidden')

    })
    closeButton.addEventListener('click', () => {
        mobileNav.classList.add('hidden');
        mobileNav.classList.remove('flex');
        closeButton.classList.add('hidden');
        menuButton.classList.remove('hidden');

    })
*/

function togglenav(){
    const menuButton = document.getElementById('menu-btn');
    const mobileNav=document.getElementById('mobile-nav');
        mobileNav.classList.toggle('hidden')
        menuButton.src= mobileNav.classList.contains('hidden') ? 'menu1.png' :'close.png'
    }
