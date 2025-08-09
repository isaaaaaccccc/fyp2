const toggleButton = document.getElementById('toggle-sidebar')
const sidebar = document.getElementById('sidebar')

document.addEventListener("DOMContentLoaded", () => {
    const links = document.querySelectorAll("#sidebar .nav-link");
    const currentPath = window.location.pathname;

    links.forEach(link => {
        if (!link.href) return;

        const linkPath = new URL(link.href).pathname;
        console.log(linkPath)
        if (linkPath === currentPath) {
            link.classList.add("active");
            link.href = "#";
        } else {
            link.classList.remove("active");
        }
    });
});

function toggleSidebar() {
    sidebar.classList.toggle('close');
    toggleButton.classList.toggle('rotate');

    closeAllSubMenus();
}

function toggleSubMenu(button) {
    if (!button.nextElementSibling.classList.contains('show')) {
        closeAllSubMenus();
    }

    button.nextElementSibling.classList.toggle('show');
    button.classList.toggle('rotate');

    if (sidebar.classList.contains('close')) {
        sidebar.classList.toggle('close');
        toggleButton.classList.toggle('rotate');
    }
}

function closeAllSubMenus() {
    Array.from(sidebar.getElementsByClassName('show')).forEach(ul => {
        ul.classList.remove('show');
        ul.previousElementSibling.classList.remove('rotate');
    });
}