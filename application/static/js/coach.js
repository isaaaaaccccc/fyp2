let coachData;

function createCard(coach) {
    const container = document.createElement('div');

    container.innerHTML = `
        <div id="coachCard_${coach.id}" class="card h-100" data-bs-toggle="modal" data-bs-target="#modal" data-id="${coach.id}">
            <div class="card-body">
                <div class="card-title d-flex justify-content-between align-items-center">
                    <h5 class="fw-bold">${coach.name}</h5>
                    <span class="badge ms-auto ${coach.status === 'Full time' ? 'bg-success' : 'bg-danger'}">
                        ${coach.status.split(' ')[0].toUpperCase()}
                    </span>
                </div>
                <h6 class="card-subtitle mb-2 text-body-secondary">${coach.position}</h6>

                <div class="mb-2">
                    <small class="fw-semibold">Branches:</small>
                    ${coach.assigned_branches.map(branch => `
                        <span class="badge bg-primary me-1">${branch.abbrv}</span>
                    `).join('')}
                </div>

                <div class="mt-auto">
                    <small class="fw-semibold">Preferred Levels:</small>
                    ${coach.preferred_levels.map(level => `
                        <span class="badge ${level.alias} text-dark me-1">
                            ${level.alias}
                        </span>
                    `).join('')}
                </div>
            </div>
        </div>
    `.trim();
    return container.firstElementChild;
}

async function updateCoaches() {
    const form = document.getElementById('coachFilter');
    const coachList = document.getElementById('coachList');
    const coachCount = document.getElementById('coachCount');
    
    const params = new URLSearchParams(new FormData(form));

    coachList.innerHTML = `
        <div id="loader" class="text-center my-5">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading…</span>
            </div>
        </div>`;
    const response = await fetch(`/api/coach?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    const coaches = await response.json();
    coachList.innerHTML = '';

    coachCount.innerText = coaches.length;
    if (coaches.length == 0) {
        coachList.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <p class="text-white fs-5">No coaches found matching your criteria.</p>
            </div>
        `;
    } else {
        coaches.forEach(coach => {
            const div = document.createElement('div');
            div.className = 'col-xl-3 col-lg-4 col-md-6 col-sm-12';
            div.appendChild(createCard(coach))

            coachList.appendChild(div);
        });
    }

    coachData = coaches;
    return coaches;
}

function updateModal(e) {
    const modal = this;
    const modalInstance = bootstrap.Modal.getInstance(this);

    const id = parseInt(e.relatedTarget.dataset.id);
    const idx = coachData.findIndex(p => p.id == id);
    const data = coachData[idx];

    const modalTitle = modal.querySelector('.modal-title span');
    const nameField = document.getElementById('editName');
    const residenceField = document.getElementById('editResidence');
    const positionField = document.getElementById('editPosition');

    const form = document.querySelector('#modal .modal-body form');

    modalTitle.innerText = `${data.name}`;
    nameField.value = nameField.placeholder = data.name;
    residenceField.value = residenceField.placeholder = data.residential_area;
    positionField.value = data.position;

    // Deselect everything
    for (const branchField of document.querySelectorAll('[id*="editBranch"]')) branchField.checked = false;
    for (const levelField of document.querySelectorAll('[id*="editLevel"]')) levelField.checked = false;
    for (const offdayField of document.querySelectorAll('[id*="editOffday"]')) offdayField.checked = false;

    for (const offday of data.offdays) {
        const offdayID = `editOffday_${offday.day[0].toUpperCase() + offday.day.slice(1).toLowerCase()}_${offday.am ? 'AM' : 'PM'}`;
        const offdayField = document.getElementById(offdayID);
        offdayField.checked = true;
    }

    for (const branch of data.assigned_branches) {
        const branchID = `editBranch_${branch.id}`;
        const branchField = document.getElementById(branchID);
        branchField.checked = true;
    }

    for (const level of data.preferred_levels) {
        const levelID = `editLevel_${level.id}`;
        const levelField = document.getElementById(levelID);
        levelField.checked = true;
    }

    // Remove all previous event listeners
    const deleteBtn = document.getElementById('deleteBtn');
    const newDeleteBtn = deleteBtn.cloneNode(true);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
    
    const saveBtn = document.getElementById('saveBtn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    
    newDeleteBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this coach?')) return;

        const response = await fetch(`/api/coach/${data.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        modalInstance.hide();
        e.relatedTarget.parentNode.remove();
    });

    newSaveBtn.addEventListener('click', async () => {
        const formData = Object.fromEntries(new FormData(form).entries());
        console.log(formData);

        const response = await fetch(`/api/coach/${data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (response.status == 200) {
            const coach = await response.json();

            coachData[idx] = coach;

            e.relatedTarget.parentNode.replaceChild(createCard(coach), e.relatedTarget);
            modalInstance.hide();
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('coachFilter');
    const nameField = document.getElementById('name');
    const cancelBtn = document.getElementById('cancelBtn');
    const modal = document.getElementById('modal');

    // Initial update when page loads
    updateCoaches();

    form.addEventListener('change', updateCoaches);
    nameField.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            updateCoaches();
        };
    });
    cancelBtn.addEventListener('click', e => {
        form.reset();
        updateCoaches();
    });
    
    modal.addEventListener('show.bs.modal', updateModal);
});