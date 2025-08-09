import renderTimetable from "./dashboard/timetable.js";

let timetableData;

function createCard(timetable) {
    const container = document.createElement('div');

    const date = new Date(timetable.date_created);

    const formatted = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);

    const uniqueCoaches = new Set(
        Object.values(timetable.data).flatMap(branch => branch.coaches || [])
    );

    const totalClasses = Object.values(timetable.data).reduce((count, branch) => {
        const schedule = branch.schedule || {};
        for (const day of Object.values(schedule)) {
            for (const sessions of Object.values(day)) {
            count += sessions.length;
            }
        }
        return count;
    }, 0);

    container.innerHTML = `
        <div id="timetableCard_${timetable.id}" class="card h-100" data-bs-toggle="modal" data-bs-target="#modal" data-id="${timetable.id}">
            <div class="card-body">
                <div class="card-title d-flex justify-content-between align-items-center">
                    <h5 class="fw-bold">Timetable #${timetable.id}</h5>
                    ${timetable.active ? '<span class="badge ms-auto bg-success">Active</span>' : ''}
                </div>

                <div class="mb-2">
                    <small class="fw-semibold">Date Created:</small>
                    ${formatted}
                </div>
                <div class="mb-2">
                    <small class="fw-semibold">Number of Coaches:</small>
                    ${uniqueCoaches.size}
                </div>
                <div class="mb-2">
                    <small class="fw-semibold">Total Number of Classes:</small>
                    ${totalClasses}
                </div>
            </div>
        </div>
    `.trim();
    return container.firstElementChild;
}

async function updateTimeable() {
    const timetableList = document.getElementById('timetableList');
    const timetableCount = document.getElementById('timetableCount');
    
    timetableList.innerHTML = `
        <div id="loader" class="text-center my-5">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading…</span>
            </div>
        </div>`;

    // TODO add pagination to timetable API
    const response = await fetch(`/api/timetable`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    const timetables = await response.json();
    timetableList.innerHTML = '';

    timetableCount.innerText = timetables.total_count;
    if (timetables.length == 0) {
        timetableList.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <p class="text-white fs-5">No saved timetables yet...</p>
            </div>
        `;
    } else {
        console.log(timetables)
        timetables.results.forEach(timetable => {
            const div = document.createElement('div');
            div.className = 'col-xl-3 col-lg-4 col-md-6 col-sm-12';
            div.appendChild(createCard(timetable))

            timetableList.appendChild(div);
        });
    }

    timetableData = timetables;
    return timetables;
}

function updateTimetable(e) {

}

function updateModal(e) {
    const modal = this;
    const modalInstance = bootstrap.Modal.getInstance(this);
    
    const id = parseInt(e.relatedTarget.dataset.id);
    const idx = timetableData.results.findIndex(t => t.id == id);
    const data = timetableData.results[idx];
    
    const modalTitle = modal.querySelector('.modal-title span');
    
    // Remove all previous event listeners
    const deleteBtn = document.getElementById('deleteBtn');
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    
    const activeBtn = document.getElementById('activeBtn');
    const newActiveBtn = activeBtn.cloneNode(true);
    activeBtn.parentNode.replaceChild(newActiveBtn, activeBtn);
    
    const branchSelect = document.getElementById('timetable-branch-select');
    const newBranchSelect = branchSelect.cloneNode(true);
    branchSelect.parentNode.replaceChild(newBranchSelect, branchSelect);

    newBranchSelect.options.length = 0;
    Object.keys(data.data).forEach(branch => {
        const option = document.createElement('option');
        option.textContent = option.value = branch;
        newBranchSelect.appendChild(option);
    })
    
    renderTimetable(
        undefined,
        'All',
        'All',
        'All',
        'All',
        undefined,
        'All',
        data.data
    )

    newBranchSelect.addEventListener('change', () => {
        console.log(newBranchSelect.value)
        console.log(data.data[newBranchSelect.value])
        renderTimetable(
            data.data[newBranchSelect.value],
            'All',
            'All',
            'All',
            'All',
            undefined,
            newBranchSelect.value,
            data.data
        );
    });

    
    newDeleteBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this timetable?')) return;

        const response = await fetch(`/api/timetable/${data.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        modalInstance.hide();
        e.relatedTarget.parentNode.remove();
        timetableCount.innerText--;
    });

    newActiveBtn.addEventListener('click', async () => {
        const response = await fetch(`/api/timetable/${data.id}/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.status == 200) {
            for (const badge of document.querySelectorAll('#timetableList .card-title .badge')) {
                badge.parentNode.removeChild(badge);
            }

            const badge = document.createElement('span');
            badge.className = 'badge ms-auto bg-success';
            badge.textContent = 'Active';
            e.relatedTarget.querySelector('.card-title').appendChild(badge);

            modalInstance.hide();
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const modal = document.getElementById('modal');

    // Initial update when page loads
    updateTimeable();
    
    modal.addEventListener('show.bs.modal', updateModal);
});