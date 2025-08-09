document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Simple data upload page loaded');
    
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const uploadForm = document.getElementById('uploadForm');
    const submitBtn = document.getElementById('submitBtn');

    // Track upload state
    let uploadState = {
        selectedFiles: new Set()
    };

    // Handle file input changes - IMMEDIATE visual feedback
    fileInputs.forEach(input => {
        const fieldName = input.id;
        const cancelBtn = document.getElementById(fieldName + '_cancel');
        
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            console.log(`📁 File selected for ${fieldName}:`, file);
            
            if (file) {
                // Validate file type
                if (!file.name.toLowerCase().endsWith('.csv')) {
                    alert('Please select a CSV file.');
                    e.target.value = '';
                    resetFileDisplay(fieldName);
                    uploadState.selectedFiles.delete(fieldName);
                    return;
                }
                
                // Add to selected files and IMMEDIATELY update visuals
                uploadState.selectedFiles.add(fieldName);
                updateFileSelected(fieldName, file);
                
                console.log(`✅ File selected and visual updated for ${fieldName}`);
            } else {
                uploadState.selectedFiles.delete(fieldName);
                resetFileDisplay(fieldName);
            }
            
            updateSubmitButton();
        });
        
        // Cancel button handler
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                removeFile(fieldName);
            });
        }
    });
    
    // Simple form submission - let Flask handle everything
    uploadForm.addEventListener('submit', function(e) {
        console.log('🚀 Form submission started');
        
        // Check if at least one file is selected
        if (uploadState.selectedFiles.size === 0) {
            e.preventDefault();
            alert('Please select at least one CSV file to upload.');
            return;
        }
        
        // Update visuals to show uploading state
        uploadState.selectedFiles.forEach(fieldName => {
            updateFileUploading(fieldName);
        });
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.value = 'Uploading...';
        
        console.log(`✅ Submitting form with ${uploadState.selectedFiles.size} files`);
        // Let the form submit normally - Flask will handle the response
    });
    
    function updateFileSelected(fieldName, file) {
        console.log(`🎨 Updating file selected visual for ${fieldName}`);
        
        const wrapper = document.getElementById(fieldName + '_wrapper');
        const card = document.getElementById(fieldName + '_card');
        const indicator = document.getElementById(fieldName + '_indicator');
        const fileInfo = document.getElementById(fieldName + '_info');
        const cancelBtn = document.getElementById(fieldName + '_cancel');
        
        // Update wrapper
        wrapper.className = 'file-input-custom has-file';
        wrapper.querySelector('.upload-icon i').className = 'bi bi-file-earmark-check';
        wrapper.querySelector('.upload-text').textContent = `Selected: ${file.name}`;
        wrapper.querySelector('.upload-subtext').textContent = 'Ready to upload - Click to change file';
        
        // Update card
        card.className = 'upload-card file-selected';
        
        // Update indicator
        indicator.className = 'upload-status-indicator selected show';
        indicator.innerHTML = '<i class="bi bi-check"></i>';
        
        // Show cancel button
        cancelBtn.classList.add('show');
        
        // Show file info
        showFileInfo(file, fileInfo, fieldName);
        
        console.log(`✅ Visual update completed for ${fieldName}`);
    }
    
    function updateFileUploading(fieldName) {
        console.log(`🎨 Updating file uploading visual for ${fieldName}`);
        
        const wrapper = document.getElementById(fieldName + '_wrapper');
        const card = document.getElementById(fieldName + '_card');
        const indicator = document.getElementById(fieldName + '_indicator');
        const fileInfo = document.getElementById(fieldName + '_info');
        
        // Update wrapper
        wrapper.className = 'file-input-custom uploading';
        wrapper.querySelector('.upload-icon i').className = 'bi bi-arrow-clockwise';
        wrapper.querySelector('.upload-text').textContent = 'Uploading...';
        wrapper.querySelector('.upload-subtext').textContent = 'Please wait while file is being processed';
        
        // Update card  
        card.className = 'upload-card uploading';
        
        // Update indicator
        indicator.className = 'upload-status-indicator uploading show';
        indicator.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        
        // Update file info status
        const statusElement = fileInfo.querySelector('.status-success');
        if (statusElement) {
            statusElement.className = 'status-uploading';
            statusElement.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';
        }
        
        console.log(`✅ Uploading visual update completed for ${fieldName}`);
    }
    
    function resetFileDisplay(fieldName) {
        console.log(`🔄 Resetting file display for ${fieldName}`);
        
        const wrapper = document.getElementById(fieldName + '_wrapper');
        const card = document.getElementById(fieldName + '_card');
        const indicator = document.getElementById(fieldName + '_indicator');
        const fileInfo = document.getElementById(fieldName + '_info');
        const cancelBtn = document.getElementById(fieldName + '_cancel');
        
        // Reset wrapper
        wrapper.className = 'file-input-custom';
        wrapper.querySelector('.upload-icon i').className = 'bi bi-file-earmark-text';
        
        const config = getFieldConfig(fieldName);
        wrapper.querySelector('.upload-text').textContent = config.text;
        wrapper.querySelector('.upload-subtext').textContent = config.subtext;
        
        // Reset card
        card.className = 'upload-card';
        
        // Reset indicator
        indicator.className = 'upload-status-indicator';
        indicator.innerHTML = '<i class="bi bi-file-earmark-text"></i>';
        
        // Hide cancel button
        cancelBtn.classList.remove('show');
        
        // Hide file info
        fileInfo.className = 'file-info';
        
        console.log(`✅ Reset completed for ${fieldName}`);
    }
    
    function removeFile(fieldName) {
        console.log(`🗑️ Removing file for ${fieldName}`);
        const fileInput = document.getElementById(fieldName);
        
        if (fileInput) {
            fileInput.value = '';
            uploadState.selectedFiles.delete(fieldName);
            resetFileDisplay(fieldName);
            updateSubmitButton();
            console.log(`✅ File removed for ${fieldName}`);
        }
    }
    
    function showFileInfo(file, fileInfoElement, fieldName) {
        const fileSize = formatFileSize(file.size);
        const lastModified = new Date(file.lastModified).toLocaleDateString();
        
        fileInfoElement.innerHTML = `
            <div class="file-details">
                <div class="file-meta">
                    <div class="file-name">${file.name}</div>
                    <div class="file-stats">
                        ${fileSize} • Modified: ${lastModified}
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <div class="status-success">
                        <i class="bi bi-check-circle"></i>
                        Ready to upload
                    </div>
                </div>
            </div>
        `;
        
        fileInfoElement.classList.add('show');
    }
    
    function updateSubmitButton() {
        if (uploadState.selectedFiles.size > 0) {
            submitBtn.disabled = false;
            submitBtn.value = `Upload ${uploadState.selectedFiles.size} File${uploadState.selectedFiles.size > 1 ? 's' : ''}`;
        } else {
            submitBtn.disabled = true;
            submitBtn.value = 'Upload Files';
        }
    }
    
    function getFieldConfig(fieldName) {
        const configs = {
            'coaches_file': {
                text: 'Choose coaches.csv file',
                subtext: 'Expected format: coach_id, coach_name, residential_area, assigned_branch, position, status, etc.'
            },
            'availability_file': {
                text: 'Choose availability.csv file',
                subtext: 'Expected format: availability_id, coach_id, day, period, available, restriction_reason'
            },
            'branch_config_file': {
                text: 'Choose branch_config.csv file',
                subtext: 'Expected format: branch, max_classes_per_slot'
            },
            'level_config_file': {
                text: 'Choose level_config.csv file',
                subtext: 'Expected format: name, alias, max_students, duration'
            },
            'enrollment_file': {
                text: 'Choose enrollment.csv file',
                subtext: 'Expected format: Branch, Level Category Base, Count'
            },
            'popular_timeslots_file': {
                text: 'Choose popular_timeslots.csv file',
                subtext: 'Expected format: time_slot, day, level'
            }
        };
        return configs[fieldName] || { text: 'Choose file', subtext: 'CSV files only' };
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Make removeFile function global
    window.removeFile = removeFile;
    
    // Initialize submit button state
    updateSubmitButton();
    
    console.log('📋 Upload state initialized');
});