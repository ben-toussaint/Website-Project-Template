


function togglenav(){
    const menuButton = document.getElementById('menu-btn');
    const mobileNav=document.getElementById('mobile-nav');
        mobileNav.classList.toggle('hidden')
        menuButton.src= mobileNav.classList.contains('hidden') ? 'menu1.png' :'close.png'
    }
