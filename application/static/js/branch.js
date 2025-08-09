document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    let branches = [];
    const branchList = document.getElementById('branchList');
    const branchCountElement = document.getElementById('branchCount');
    const nameFilter = document.getElementById('name');
    const maxClassFilter = document.getElementById('max_classes');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Slider value display for modals
    document.getElementById('editMaxClasses').addEventListener('input', function() {
        document.getElementById('editMaxClassesValue').textContent = this.value;
    });
    
    document.getElementById('newMaxClasses').addEventListener('input', function() {
        document.getElementById('newMaxClassesValue').textContent = this.value;
    });
    
    // Load branch data
    fetchBranches();
    
    // Event listeners for filters
    nameFilter.addEventListener('input', filterBranches);
    maxClassFilter.addEventListener('change', filterBranches);
    cancelBtn.addEventListener('click', clearFilters);
    
    // Modal action buttons
    document.getElementById('saveBranchChangesBtn').addEventListener('click', saveBranchChanges);
    document.getElementById('addBranchBtn').addEventListener('click', addNewBranch);
    document.getElementById('deleteBranchBtn').addEventListener('click', showDeleteConfirmation);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteBranch);
    
    // Fetch branches from API
    function fetchBranches() {
        fetch('/api/branch/')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    branches = data.branches;
                    displayBranches(branches);
                } else {
                    console.error('Error fetching branches:', data.message);
                    showToast('error', 'Error fetching branches', data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('error', 'Connection Error', 'Failed to connect to the server.');
            });
    }
    
    // Display branches
    function displayBranches(branchesToShow) {
        // Clear existing branches but keep the "Add New" card
        const addBranchCard = document.querySelector('.branch-add-card').closest('.col-xl-3');
        branchList.innerHTML = '';
        branchList.appendChild(addBranchCard);
        
        // Update count
        branchCountElement.textContent = branchesToShow.length;
        
        // Add each branch
        branchesToShow.forEach(branch => {
            const col = document.createElement('div');
            col.className = 'col-xl-3 col-lg-4 col-md-6';
            
            col.innerHTML = `
                <div class="card branch-card h-100 shadow-sm" data-id="${branch.id}">
                    <div class="card-header bg-primary text-white">
                        <h5 class="card-title mb-0">${branch.name} <span class="badge bg-light text-primary">${branch.abbrv}</span></h5>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <h6 class="text-muted">Maximum Classes Per Slot</h6>
                            <div class="d-flex align-items-center">
                                <div class="progress flex-grow-1" style="height: 10px;">
                                    <div class="progress-bar bg-success" role="progressbar" style="width: ${(branch.max_classes / 10) * 100}%"></div>
                                </div>
                                <span class="ms-2 fw-bold">${branch.max_classes}</span>
                            </div>
                        </div>
                        
                        <div class="d-flex justify-content-between align-items-center mt-4">
                            <small class="text-muted">ID: ${branch.id}</small>
                            <button class="btn btn-outline-primary btn-sm edit-branch" data-bs-toggle="modal" data-bs-target="#editBranchModal">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add before the "Add New" card
            branchList.insertBefore(col, addBranchCard);
            
            // Add event listener to edit button
            col.querySelector('.edit-branch').addEventListener('click', function() {
                setEditModalData(branch);
            });
        });
    }
    
    // Filter branches based on inputs
    function filterBranches() {
        const nameValue = nameFilter.value.toLowerCase();
        const maxClassValue = maxClassFilter.value;
        
        const filtered = branches.filter(branch => {
            // Name filter
            const nameMatch = branch.name.toLowerCase().includes(nameValue) || 
                             branch.abbrv.toLowerCase().includes(nameValue);
            
            // Max class filter
            let maxClassMatch = true;
            if (maxClassValue) {
                if (maxClassValue === 'more') {
                    maxClassMatch = branch.max_classes > 6;
                } else {
                    maxClassMatch = branch.max_classes <= parseInt(maxClassValue);
                }
            }
            
            return nameMatch && maxClassMatch;
        });
        
        displayBranches(filtered);
    }
    
    // Clear filters
    function clearFilters() {
        nameFilter.value = '';
        maxClassFilter.value = '';
        displayBranches(branches);
    }
    
    // Set data in edit modal
    function setEditModalData(branch) {
        document.getElementById('editBranchId').value = branch.id;
        document.getElementById('modalBranchName').textContent = branch.name;
        document.getElementById('editName').value = branch.name;
        document.getElementById('editAbbrv').value = branch.abbrv;
        document.getElementById('editMaxClasses').value = branch.max_classes;
        document.getElementById('editMaxClassesValue').textContent = branch.max_classes;
    }
    

    // Save branch changes
    function saveBranchChanges() {
        const branchId = document.getElementById('editBranchId').value;
        const name = document.getElementById('editName').value;
        const abbrv = document.getElementById('editAbbrv').value;
        const maxClasses = document.getElementById('editMaxClasses').value;
        
        // Validate
        resetValidation();
        let isValid = true;
        
        if (!name.trim()) {
            document.getElementById('editName').classList.add('is-invalid');
            document.getElementById('editNameError').textContent = "Branch name is required";
            isValid = false;
        }
        
        if (!abbrv.trim()) {
            document.getElementById('editAbbrv').classList.add('is-invalid');
            document.getElementById('editAbbrvError').textContent = "Abbreviation is required";
            isValid = false;
        } else if (abbrv.length > 4) {
            document.getElementById('editAbbrv').classList.add('is-invalid');
            document.getElementById('editAbbrvError').textContent = "Abbreviation must be 4 characters or less";
            isValid = false;
        }
        
        if (!isValid) {
            return;
        }
        
        // Show loading state
        const saveButton = document.getElementById('saveBranchChangesBtn');
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        
        const data = {
            name: name.trim(),
            abbrv: abbrv.trim().toUpperCase(),
            max_classes: parseInt(maxClasses)
        };
        
        console.log("Sending update request:", data);
        
        fetch(`/api/branch/${branchId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('success', 'Branch Updated', `Branch "${name}" has been updated successfully.`);
                fetchBranches(); // Refresh branch list
                $('#editBranchModal').modal('hide');
            } else {
                console.error('Update error:', data);
                
                // Handle specific validation errors if provided
                if (data.errors && Array.isArray(data.errors)) {
                    data.errors.forEach(error => {
                        if (error.includes('name')) {
                            document.getElementById('editName').classList.add('is-invalid');
                            document.getElementById('editNameError').textContent = error;
                        } else if (error.includes('abbreviation')) {
                            document.getElementById('editAbbrv').classList.add('is-invalid');
                            document.getElementById('editAbbrvError').textContent = error;
                        } else {
                            showToast('error', 'Validation Error', error);
                        }
                    });
                } else {
                    showToast('error', 'Update Error', data.message || 'Unknown error occurred');
                }
            }
            
            // Reset button state
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('error', 'Connection Error', 'Failed to connect to the server.');
            
            // Reset button state
            saveButton.disabled = false;
            saveButton.textContent = originalText;
        });
    }

    // Add new branch
    function addNewBranch() {
        const name = document.getElementById('newName').value;
        const abbrv = document.getElementById('newAbbrv').value;
        const maxClasses = document.getElementById('newMaxClasses').value;
        
        // Validate
        resetValidation();
        let isValid = true;
        
        if (!name.trim()) {
            document.getElementById('newName').classList.add('is-invalid');
            document.getElementById('newNameError').textContent = "Branch name is required";
            isValid = false;
        }
        
        if (!abbrv.trim()) {
            document.getElementById('newAbbrv').classList.add('is-invalid');
            document.getElementById('newAbbrvError').textContent = "Abbreviation is required";
            isValid = false;
        } else if (abbrv.length > 4) {
            document.getElementById('newAbbrv').classList.add('is-invalid');
            document.getElementById('newAbbrvError').textContent = "Abbreviation must be 4 characters or less";
            isValid = false;
        }
        
        if (!isValid) {
            return;
        }
        
        const data = {
            name: name,
            abbrv: abbrv.toUpperCase(),
            max_classes: parseInt(maxClasses)
        };
        
        fetch('/api/branch/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('success', 'Branch Added', `Branch "${name}" has been added successfully.`);
                fetchBranches(); // Refresh branch list
                $('#addBranchModal').modal('hide');
                
                // Clear form
                document.getElementById('newName').value = '';
                document.getElementById('newAbbrv').value = '';
                document.getElementById('newMaxClasses').value = 4;
                document.getElementById('newMaxClassesValue').textContent = '4';
            } else {
                showToast('error', 'Error Adding Branch', data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('error', 'Connection Error', 'Failed to connect to the server.');
        });
    }
    
    // Reset validation states
    function resetValidation() {
        // Reset edit form
        document.getElementById('editName').classList.remove('is-invalid');
        document.getElementById('editAbbrv').classList.remove('is-invalid');
        document.getElementById('editNameError').textContent = '';
        document.getElementById('editAbbrvError').textContent = '';
        
        // Reset new form
        document.getElementById('newName').classList.remove('is-invalid');
        document.getElementById('newAbbrv').classList.remove('is-invalid');
        document.getElementById('newNameError').textContent = '';
        document.getElementById('newAbbrvError').textContent = '';
    }
    
    // Show delete confirmation modal
    function showDeleteConfirmation() {
        const branchId = document.getElementById('editBranchId').value;
        const branchName = document.getElementById('editName').value;
        
        document.getElementById('confirmBranchName').textContent = branchName;
        $('#editBranchModal').modal('hide');
        $('#confirmationModal').modal('show');
    }
    
    // Delete branch
    function deleteBranch() {
        const branchId = document.getElementById('editBranchId').value;
        
        fetch(`/api/branch/${branchId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('success', 'Branch Deleted', `The branch has been deleted successfully.`);
                fetchBranches(); // Refresh branch list
                $('#confirmationModal').modal('hide');
            } else {
                showToast('error', 'Deletion Error', data.message);
                $('#confirmationModal').modal('hide');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('error', 'Connection Error', 'Failed to connect to the server.');
            $('#confirmationModal').modal('hide');
        });
    }
    
    // Helper function to show toast notifications
    function showToast(type, title, message) {
        const toastClasses = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };
        
        const iconClasses = {
            success: 'bi-check-circle',
            error: 'bi-exclamation-circle',
            warning: 'bi-exclamation-triangle',
            info: 'bi-info-circle'
        };
        
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '1050';
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${toastClasses[type]} text-white`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="toast-header ${toastClasses[type]} text-white">
                <i class="bi ${iconClasses[type]} me-2"></i>
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 5000
        });
        bsToast.show();
        
        // Remove toast after it's hidden
        toast.addEventListener('hidden.bs.toast', function() {
            toast.remove();
        });
    }
});