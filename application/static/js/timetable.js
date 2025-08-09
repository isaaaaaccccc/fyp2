// Constants
const days = ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]; // Removed Monday
const timeSlots = [];
for (let hour = 9; hour <= 19; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 19 && minute > 0) break;
        const timeStr = hour.toString().padStart(2, '0') + minute.toString().padStart(2, '0');
        timeSlots.push(timeStr);
    }
}

// Branch opening hours
const branchHours = {
    "Monday": { open: null, close: null }, // Closed
    "Tuesday": { open: "1500", close: "1900" }, // 3pm - 7pm
    "Wednesday": { open: "1000", close: "1900" }, // 10am - 7pm
    "Thursday": { open: "1000", close: "1900" }, // 10am - 7pm
    "Friday": { open: "1000", close: "1900" }, // 10am - 7pm
    "Saturday": { open: "0830", close: "1830" }, // 8:30am - 6:30pm
    "Sunday": { open: "0830", close: "1830" }  // 8:30am - 6:30pm
};

// Lunch break hours (weekdays only)
const lunchBreak = {
    start: "1200", // 12pm
    end: "1400"    // 2pm
};

// Global Variables
// This variable will handle the data that's to be saved to the database 
let data = {};
let draggedData = null;
let branchCapacities = {}; // Cache for branch max_classes values
let currentHighlightedSlot = null; // Track the currently highlighted slot
let branchFilter = null; // No filter by default - show all branches
let dbCoaches = []; // Store coaches from the database

// Functions
function formatTime(timeStr) {
    if (!timeStr) return '';
    
    const padded = timeStr.toString().padStart(4, '0');
    const hours = parseInt(padded.slice(0, 2), 10);
    const minutes = padded.slice(2, 4);

    const period = hours >= 12 ? 'pm' : 'am';
    const hours12 = hours % 12 || 12;

    return `${hours12}:${minutes}${period}`;
}

function scheduleMatrix(schedule, coaches) {
    const matrix = {};
    coaches.forEach(coach => {
        matrix[coach] = new Array(timeSlots.length).fill(null);
    });

    if (!schedule) return matrix;

    for (const [coach, classes] of Object.entries(schedule)) {
        if (!Array.isArray(classes)) continue;
        
        classes.forEach(classInfo => {
            if (!classInfo || !classInfo.start_time) return;
            
            const startIdx = timeSlots.indexOf(classInfo.start_time);
            if (startIdx === -1) return;

            const duration = classInfo.duration || 2;  // Default to 2 time slots (1 hour)
            
            for (let i = 0; i < duration; i++) {
                if ((startIdx + i) >= timeSlots.length) break;

                matrix[coach][startIdx + i] = {
                    name: classInfo.name || 'Unknown',
                    startIdx: startIdx,
                    position: i,
                    duration: duration,
                };
            }
        });
    }

    return matrix;
}

function createClassBlock(classInfo, branch, day, coach, timeIdx) {
    const classBlock = document.createElement('div');
    classBlock.className = `class-block ${classInfo.name}`;
    classBlock.textContent = classInfo.name;
    classBlock.draggable = true;
    
    classBlock.dataset.branch = branch;
    classBlock.dataset.day = day;
    classBlock.dataset.coach = coach;
    classBlock.dataset.level = classInfo.name;
    classBlock.dataset.duration = classInfo.duration;
    classBlock.dataset.startIdx = timeIdx;
    classBlock.style.height = `calc(${classInfo.duration * 100}% - 16px)`;

    classBlock.addEventListener('dragstart', handleDragStart);
    classBlock.addEventListener('dragend', handleDragEnd);

    return classBlock;
}

function renderBranchTimetable(branch, branchData, timetableDiv) {
    const coachOrder = branchData.coaches || [];
    // Sort coach names alphabetically
    coachOrder.sort((a, b) => a.localeCompare(b));
    
    const matrix = {};
    days.forEach(day => {
        if (!branchData.schedule[day]) {
            matrix[day] = {};
            return;
        }
        matrix[day] = scheduleMatrix(branchData.schedule[day], coachOrder);
    });

    const branchContainer = document.createElement('div');
    branchContainer.className = 'branch-timetable-container mb-5';
    
    // Create branch header with buttons
    const headerRow = document.createElement('div');
    headerRow.className = 'd-flex justify-content-between align-items-center mb-2';
    
    const branchTitle = document.createElement('h3');
    branchTitle.textContent = branch;
    branchTitle.className = 'mb-0';
    headerRow.appendChild(branchTitle);
    
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'btn-group';
    
    // Add coach button
    const addCoachBtn = document.createElement('button');
    addCoachBtn.className = 'btn btn-sm btn-outline-success';
    addCoachBtn.innerHTML = '<i class="bi bi-person-plus"></i> Add Coach';
    addCoachBtn.addEventListener('click', () => openAddCoachModal(branch));
    buttonGroup.appendChild(addCoachBtn);
    
    // Add class button
    const addClassBtn = document.createElement('button');
    addClassBtn.className = 'btn btn-sm btn-outline-primary ms-2';
    addClassBtn.innerHTML = '<i class="bi bi-plus-circle"></i> Add Class';
    addClassBtn.addEventListener('click', () => openAddClassModal(branch));
    buttonGroup.appendChild(addClassBtn);
    
    headerRow.appendChild(buttonGroup);
    branchContainer.appendChild(headerRow);

    const responsiveDiv = document.createElement('div');
    responsiveDiv.className = 'table-responsive';
    branchContainer.appendChild(responsiveDiv);

    const table = document.createElement('table');
    table.className = 'table table-bordered table-secondary';
    table.id = `timetable-${branch}`; // Add an ID to the table for easy reference
    responsiveDiv.appendChild(table);

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    const dayRow = document.createElement('tr');
    const coachRow = document.createElement('tr');

    const timeHeader = document.createElement('th');
    timeHeader.textContent = 'Timing';
    timeHeader.rowSpan = 2;
    timeHeader.className = 'time-slot separator';
    dayRow.appendChild(timeHeader);

    // Create table header, containing day and coaches working
    for (const day of days) {
        if (!branchData.schedule[day]) continue;
        
        const coaches = Object.keys(branchData.schedule[day]).filter(coach => coachOrder.includes(coach)).sort();
        if (coaches.length === 0) continue;
        
        const dayHeader = document.createElement('th');
        dayHeader.className = 'day-header separator';
        dayHeader.textContent = day;
        dayHeader.dataset.day = day;
        dayHeader.colSpan = coaches.length;
        
        // Add day management dropdown
        const dayManageBtn = document.createElement('button');
        dayManageBtn.className = 'btn btn-sm btn-outline-secondary float-end ms-2';
        dayManageBtn.innerHTML = '<i class="bi bi-gear-fill"></i>';
        dayManageBtn.title = "Manage coaches for this day";
        dayManageBtn.addEventListener('click', () => openRemoveCoachModal(branch, day));
        dayHeader.appendChild(dayManageBtn);
        
        dayRow.appendChild(dayHeader);
        
        coaches.forEach((coach, coachIdx) => {
            const coachHeader = document.createElement('th');
            coachHeader.textContent = coach;
            coachHeader.className = 'coach-header';
            coachHeader.dataset.day = day;
            coachHeader.dataset.coach = coach; // Add coach data attribute for identification
            if (coachIdx === coaches.length - 1) coachHeader.classList.add('separator');

            coachRow.appendChild(coachHeader);
        });
    }

    // Remove separator from last day-header if it exists
    if (dayRow.lastChild && dayRow.lastChild.classList) {
        dayRow.lastChild.classList.remove('separator');
    }

    // Create timetable body
    for (const [timeIdx, timeSlot] of timeSlots.slice(0, -1).entries()) {
        const row = document.createElement('tr');
        row.dataset.timeSlot = timeSlot;
        row.dataset.timeIndex = timeIdx;
        
        const timeCell = document.createElement('td');
        timeCell.textContent = `${formatTime(timeSlot)} - ${formatTime(timeSlots[timeIdx + 1])}`;
        timeCell.className = 'time-slot separator';
        row.appendChild(timeCell);
        
        for (const day of days) {
            if (!branchData.schedule[day]) continue;

            const coaches = Object.keys(branchData.schedule[day]).filter(coach => coachOrder.includes(coach)).sort();
            if (coaches.length === 0) continue;
            
            coaches.forEach((coach, coachIdx) => {
                
                const cell = document.createElement('td');
                cell.className = 'class-cell';
                cell.dataset.branch = branch;
                cell.dataset.day = day;
                cell.dataset.coach = coach;
                cell.dataset.timeIdx = timeIdx;
                cell.dataset.timeSlot = timeSlot;

                cell.addEventListener('dragover', handleDragOver);
                cell.addEventListener('dragenter', handleDragEnter);
                cell.addEventListener('dragleave', handleDragLeave);
                cell.addEventListener('drop', handleDrop);
                
                // Double click on empty cell to add class
                cell.addEventListener('dblclick', () => {
                    if (!cell.querySelector('.class-block')) {
                        openAddClassModal(branch, day, coach, timeSlot);
                    }
                });

                if (coachIdx === coaches.length - 1) cell.classList.add('separator');
                row.appendChild(cell);
                
                if (!matrix[day][coach]) return; // Skip if no schedule for this coach
                
                const classInfo = matrix[day][coach][timeIdx];  // Check if a class exists for the coach on this day and time
                if (!classInfo || classInfo.position !== 0) return;

                const classBlock = createClassBlock(classInfo, branch, day, coach, timeIdx);

                cell.appendChild(classBlock);
            });
        }
        tbody.appendChild(row);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    thead.appendChild(dayRow);
    thead.appendChild(coachRow);
    timetableDiv.appendChild(branchContainer);
}

// Create branch selector
function createBranchSelector(branches) {
    const selectorContainer = document.getElementById('branchSelectorContainer');
    if (!selectorContainer) return;
    
    selectorContainer.innerHTML = '';
    
    const row = document.createElement('div');
    row.className = 'row mb-3';
    
    // Add "All Branches" option
    const allCol = document.createElement('div');
    allCol.className = 'col-auto';
    
    const allBtn = document.createElement('button');
    allBtn.className = 'btn btn-sm ' + (branchFilter === null ? 'btn-primary' : 'btn-outline-primary');
    allBtn.textContent = 'All Branches';
    allBtn.addEventListener('click', () => {
        branchFilter = null;
        renderTimetable(data);
    });
    
    allCol.appendChild(allBtn);
    row.appendChild(allCol);
    
    // Add each branch option
    branches.forEach(branch => {
        const col = document.createElement('div');
        col.className = 'col-auto';
        
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm ' + (branchFilter === branch ? 'btn-primary' : 'btn-outline-primary');
        btn.textContent = branch;
        btn.addEventListener('click', () => {
            branchFilter = branch;
            renderTimetable(data);
        });
        
        col.appendChild(btn);
        row.appendChild(col);
    });
    
    selectorContainer.appendChild(row);
}

async function renderTimetable(data) {
    const mainContainer = document.getElementById('timetableDiv');
    mainContainer.innerHTML = '';
    
    // Reset the currently highlighted slot
    currentHighlightedSlot = null;
    
    // Add defensive check at the beginning
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
        mainContainer.innerHTML = '<div class="alert alert-warning">No timetable data available.</div>';
        return;
    }

    // Update branch selector
    const branchList = Object.keys(data);
    createBranchSelector(branchList);

    // Fetch branch capacities if not already cached
    if (Object.keys(branchCapacities).length === 0) {
        try {
            const response = await fetch('/api/branch/');
            const result = await response.json();
            
            if (result.success) {
                result.branches.forEach(branch => {
                    branchCapacities[branch.abbrv] = branch.max_classes;
                });
            }
        } catch (error) {
            console.error('Error fetching branch capacities:', error);
        }
    }

    // Filter branches if needed
    let branchesToRender = branchList;
    if (branchFilter) {
        branchesToRender = branchList.filter(b => b === branchFilter);
    }

    // For each branch, show capacity followed by timetable
    for (const branch of branchesToRender) {
        const branchData = data[branch];
        
        if (!branchData || !branchData.coaches || !branchData.schedule) {
            continue;
        }
        
        // Container for this branch's content
        const branchContainer = document.createElement('div');
        branchContainer.className = 'branch-container mb-4';
        branchContainer.dataset.branch = branch;
        mainContainer.appendChild(branchContainer);
        
        // 1. Generate spare capacity section for this branch
        await generateSpareCapacitySection(branch, branchData, branchContainer);
        
        // 2. Render timetable for this branch
        renderBranchTimetable(branch, branchData, branchContainer);
    }

    // If no branches were rendered, show a message
    if (branchesToRender.length === 0) {
        mainContainer.innerHTML = '<div class="alert alert-info">No branch data available for the selected filter.</div>';
    }
}

function addClass(branch, day, coach, time, level, duration) {
    const timeIdx = timeSlots.indexOf(time);
    if (timeIdx === -1) {
        console.error(`${time} is not a valid timeslot`);
        return;
    }
    
    // Ensure minimum duration of 1 hour (2 time slots)
    const actualDuration = Math.max(2, duration || 2);
    
    // Initialize data structure if needed
    if (!data[branch]) {
        data[branch] = {
            coaches: [coach],
            schedule: {}
        };
    }
    
    if (!data[branch].schedule[day]) {
        data[branch].schedule[day] = {};
    }
    
    if (!data[branch].coaches.includes(coach)) {
        data[branch].coaches.push(coach);
    }
    
    if (!data[branch].schedule[day][coach]) {
        data[branch].schedule[day][coach] = [];
    }
    
    // Add class
    data[branch].schedule[day][coach].push({
        name: level,
        start_time: time,
        duration: actualDuration  // Ensure minimum duration of 1 hour
    });
    
    // Re-render timetable
    renderTimetable(data);
    
    return true;
}

function removeClass(branch, day, coach, time) {
    if (!branch || !day || !coach || !time) return;
    
    const timeIdx = timeSlots.indexOf(time);
    if (timeIdx === -1) {
        console.error(`${time} is not a valid timeslot`);
        return;
    }
    
    const classes = data?.[branch]?.schedule?.[day]?.[coach];
    if (!classes) return;

    const classIdx = classes.findIndex(cls => cls.start_time === time);
    if (classIdx === -1) return;

    classes.splice(classIdx, 1);
    
    // Clean up empty structures
    if (classes.length === 0) {
        delete data[branch].schedule[day][coach];
    }
    
    if (Object.keys(data[branch].schedule[day]).length === 0) {
        delete data[branch].schedule[day];
    }
    
    // Re-render timetable
    renderTimetable(data);
}

// Add a coach to a branch for a specific day
function addCoachToDay(branch, day, coach) {
    // Initialize data structure if needed
    if (!data[branch]) {
        data[branch] = {
            coaches: [],
            schedule: {}
        };
    }
    
    if (!data[branch].schedule[day]) {
        data[branch].schedule[day] = {};
    }
    
    // Add coach to branch coaches list if not already there
    if (!data[branch].coaches.includes(coach)) {
        data[branch].coaches.push(coach);
    }
    
    // Initialize empty class array for the coach on this day if it doesn't exist
    if (!data[branch].schedule[day][coach]) {
        data[branch].schedule[day][coach] = [];
    }
    
    // Re-render timetable
    renderTimetable(data);
    
    return true;
}

// Remove a coach from a specific day
function removeCoachFromDay(branch, day, coach) {
    if (!branch || !day || !coach) return false;
    
    if (!data[branch] || !data[branch].schedule || !data[branch].schedule[day] || !data[branch].schedule[day][coach]) {
        return false;
    }
    
    // Remove coach's classes for this day
    delete data[branch].schedule[day][coach];
    
    // Check if the coach is still needed in other days
    let coachStillNeeded = false;
    for (const d in data[branch].schedule) {
        if (data[branch].schedule[d][coach]) {
            coachStillNeeded = true;
            break;
        }
    }
    
    // If coach is no longer needed anywhere, remove from coaches list
    if (!coachStillNeeded) {
        const coachIdx = data[branch].coaches.indexOf(coach);
        if (coachIdx !== -1) {
            data[branch].coaches.splice(coachIdx, 1);
        }
    }
    
    // Clean up empty day if no more coaches
    if (Object.keys(data[branch].schedule[day]).length === 0) {
        delete data[branch].schedule[day];
    }
    
    // Re-render timetable
    renderTimetable(data);
    
    return true;
}

// Fetch available coaches from database
async function fetchCoachesFromDatabase() {
    try {
        // First try to get coaches via API
        const response = await fetch('/api/coaches/');
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                dbCoaches = result.coaches;
                return dbCoaches;
            }
        }
        
        // Fallback: try a different endpoint format
        const fallbackResponse = await fetch('/api/coach/');
        if (fallbackResponse.ok) {
            const result = await fallbackResponse.json();
            if (result.success) {
                dbCoaches = result.coaches;
                return dbCoaches;
            }
        }
        
        // If both fail, try to use the existing timetable data
        console.warn('Could not fetch coaches from API, using fallback method');
        return getAllCoachesFromTimetable();
    } catch (error) {
        console.error('Error fetching coaches:', error);
        return getAllCoachesFromTimetable(); // Fallback to using existing timetable data
    }
}

// Get all coaches from timetable data as fallback
function getAllCoachesFromTimetable() {
    const allCoaches = new Set();
    
    // Extract all coach names from the existing timetable data
    for (const branch in data) {
        if (data[branch] && data[branch].coaches) {
            data[branch].coaches.forEach(coach => allCoaches.add(coach));
        }
    }
    
    // Convert to array of objects to match expected format
    return Array.from(allCoaches).map(name => ({ name }));
}

// Open add coach modal for a specific branch
async function openAddCoachModal(branch) {
    // Set branch value in hidden input
    document.getElementById('coachBranchInput').value = branch;
    
    // Update modal title
    document.getElementById('addCoachModalLabel').textContent = `Add Coach to ${branch}`;
    
    // Show loading state
    const coachSelect = document.getElementById('coachSelect');
    coachSelect.innerHTML = '<option value="">Loading coaches...</option>';
    
    // Fetch coaches if we don't have them yet
    if (dbCoaches.length === 0) {
        await fetchCoachesFromDatabase();
    }
    
    // Get existing coaches in this branch for filtering
    const existingCoaches = data[branch] ? data[branch].coaches || [] : [];
    
    // Filter coaches to only those not already in this branch
    const availableCoaches = dbCoaches.filter(coach => !existingCoaches.includes(coach.name));
    
    // Populate the dropdown
    coachSelect.innerHTML = '';
    const noCoachesAlert = document.getElementById('noCoachesAlert');
    
    if (availableCoaches.length === 0) {
        coachSelect.innerHTML = '<option value="">No coaches available</option>';
        document.getElementById('addCoachSubmitBtn').disabled = true;
        
        if (noCoachesAlert) {
            noCoachesAlert.classList.remove('d-none');
        }
    } else {
        document.getElementById('addCoachSubmitBtn').disabled = false;
        
        if (noCoachesAlert) {
            noCoachesAlert.classList.add('d-none');
        }
        
        availableCoaches.forEach(coach => {
            const displayName = coach.status ? 
                `${coach.name} (${coach.status})` : 
                coach.name;
            const option = new Option(displayName, coach.name);
            coachSelect.appendChild(option);
        });
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('addCoachModal'));
    modal.show();
}

// Open the remove coach modal for a specific branch and day
function openRemoveCoachModal(branch, day) {
    // Set values in hidden inputs
    document.getElementById('removeCoachBranchInput').value = branch;
    document.getElementById('removeCoachDayInput').value = day;
    
    // Update modal title
    document.getElementById('removeCoachModalLabel').textContent = `Remove Coach from ${branch} on ${day}`;
    
    // Get coaches for this branch and day
    const coachesForDay = data[branch]?.schedule?.[day] ? Object.keys(data[branch].schedule[day]) : [];
    
    // Populate the dropdown
    const coachSelect = document.getElementById('removeCoachSelect');
    coachSelect.innerHTML = '';
    
    if (coachesForDay.length === 0) {
        coachSelect.innerHTML = '<option value="">No coaches available</option>';
        document.getElementById('removeCoachSubmitBtn').disabled = true;
    } else {
        document.getElementById('removeCoachSubmitBtn').disabled = false;
        
        // Sort coaches alphabetically
        coachesForDay.sort();
        
        coachesForDay.forEach(coach => {
            const classCount = data[branch].schedule[day][coach].length;
            const option = new Option(`${coach} (${classCount} classes)`, coach);
            coachSelect.appendChild(option);
        });
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('removeCoachModal'));
    modal.show();
}

// Open add class modal for a specific branch (with optional day, coach, and time)
function openAddClassModal(branch, day = null, coach = null, time = null) {
    // Set branch value in hidden input
    document.getElementById('classBranchInput').value = branch;
    
    // Update modal title
    document.getElementById('addClassModalLabel').textContent = `Add New Class to ${branch}`;
    
    // Populate coach dropdown for the branch
    populateClassCoachDropdown(branch);
    
    // Set day if provided
    if (day) {
        document.getElementById('classDaySelect').value = day;
    }
    
    // Set coach if provided
    if (coach) {
        const coachSelect = document.getElementById('classCoachSelect');
        // We need to make sure the option exists
        let found = false;
        for (let i = 0; i < coachSelect.options.length; i++) {
            if (coachSelect.options[i].value === coach) {
                coachSelect.selectedIndex = i;
                found = true;
                break;
            }
        }
        
        // If we couldn't find the coach, we may need to add them
        if (!found && coach) {
            const option = new Option(coach, coach);
            coachSelect.add(option);
            coachSelect.value = coach;
        }
    }
    
    // Update time slots based on selected day
    const selectedDay = document.getElementById('classDaySelect').value;
    populateStartTimeDropdown(branch, selectedDay);
    
    // Set time if provided
    if (time) {
        const timeSelect = document.getElementById('startTimeSelect');
        // We need to make sure the option exists
        for (let i = 0; i < timeSelect.options.length; i++) {
            if (timeSelect.options[i].value === time) {
                timeSelect.selectedIndex = i;
                break;
            }
        }
    }
    
    // Add event listeners to update the time slots when day changes
    document.getElementById('classDaySelect').addEventListener('change', function() {
        populateStartTimeDropdown(branch, this.value);
    });
    
    // Clear any previous feedback
    document.getElementById('availabilityFeedback').classList.add('d-none');
    document.getElementById('validationErrors').classList.add('d-none');
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('addClassModal'));
    modal.show();
}

// Populate coach dropdown for the Add Class modal
function populateClassCoachDropdown(branch) {
    const dropdown = document.getElementById('classCoachSelect');
    dropdown.innerHTML = '';
    
    // Get all coaches for this branch
    if (data[branch] && data[branch].coaches) {
        const coaches = [...data[branch].coaches].sort();
        coaches.forEach(coach => {
            const option = new Option(coach, coach);
            dropdown.appendChild(option);
        });
    } else {
        dropdown.innerHTML = '<option value="">No coaches available - add a coach first</option>';
    }
}

// Populate the start time dropdown based on branch opening hours and day
function populateStartTimeDropdown(branch, day) {
    const dropdown = document.getElementById('startTimeSelect');
    dropdown.innerHTML = '';
    
    const dayHours = branchHours[day];
    if (!dayHours.open || !dayHours.close) {
        dropdown.innerHTML = '<option value="">Branch closed on this day</option>';
        return;
    }
    
    // Find valid start times within opening hours
    for (let i = 0; i < timeSlots.length - 1; i++) {
        const timeSlot = timeSlots[i];
        
        // Skip if not within opening hours or during lunch break on weekdays
        if (timeSlot < dayHours.open || timeSlot >= dayHours.close) continue;
        if (['Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day) && 
            timeSlot >= lunchBreak.start && timeSlot < lunchBreak.end) continue;
        
        // Add option
        const option = new Option(formatTime(timeSlot), timeSlot);
        dropdown.appendChild(option);
    }
}

// Check availability for the selected class options
function checkAvailability() {
    const branch = document.getElementById('classBranchInput').value;
    const day = document.getElementById('classDaySelect').value;
    const coach = document.getElementById('classCoachSelect').value;
    const startTime = document.getElementById('startTimeSelect').value;
    const duration = parseInt(document.getElementById('durationSelect').value);
    
    const feedbackDiv = document.getElementById('availabilityFeedback');
    const errorsDiv = document.getElementById('validationErrors');
    feedbackDiv.classList.add('d-none');
    errorsDiv.classList.add('d-none');
    
    // Validate inputs
    if (!branch || !day || !coach || !startTime || !duration) {
        errorsDiv.textContent = 'Please fill in all fields';
        errorsDiv.classList.remove('d-none');
        return false;
    }
    
    // Check if the coach already has a class at this time
    const startIdx = timeSlots.indexOf(startTime);
    if (startIdx === -1) {
        errorsDiv.textContent = 'Invalid start time';
        errorsDiv.classList.remove('d-none');
        return false;
    }
    
    // Check if any of the slots are already occupied
    let conflicts = 0;
    if (data[branch] && data[branch].schedule && data[branch].schedule[day] && data[branch].schedule[day][coach]) {
        const existingClasses = data[branch].schedule[day][coach];
        
        for (const existingClass of existingClasses) {
            const existingStartIdx = timeSlots.indexOf(existingClass.start_time);
            const existingDuration = existingClass.duration || 2;
            
            // Check for overlap
            for (let i = 0; i < duration; i++) {
                const currSlot = startIdx + i;
                for (let j = 0; j < existingDuration; j++) {
                    const existingSlot = existingStartIdx + j;
                    if (currSlot === existingSlot) {
                        conflicts++;
                    }
                }
            }
        }
    }
    
    // Check branch capacity
    const maxBranchCapacity = branchCapacities[branch] || 4;
    let capacityIssues = false;
    
    if (data[branch] && data[branch].schedule && data[branch].schedule[day]) {
        // Count existing classes at each time slot
        const slotUsage = {};
        
        for (const coachName in data[branch].schedule[day]) {
            for (const classInfo of data[branch].schedule[day][coachName]) {
                const existingStartIdx = timeSlots.indexOf(classInfo.start_time);
                const existingDuration = classInfo.duration || 2;
                
                for (let i = 0; i < existingDuration; i++) {
                    const slot = timeSlots[existingStartIdx + i];
                    if (!slotUsage[slot]) slotUsage[slot] = 0;
                    slotUsage[slot]++;
                }
            }
        }
        
        // Check if adding this class would exceed capacity
        for (let i = 0; i < duration; i++) {
            const slot = timeSlots[startIdx + i];
            if (slotUsage[slot] && slotUsage[slot] >= maxBranchCapacity) {
                capacityIssues = true;
                break;
            }
        }
    }
    
    // Check if adding this class would extend beyond branch hours
    let outsideBranchHours = false;
    const dayHours = branchHours[day];
    
    if (startIdx + duration >= timeSlots.length) {
        outsideBranchHours = true;
    } else {
        const endTime = timeSlots[startIdx + duration - 1];
        if (endTime >= dayHours.close) {
            outsideBranchHours = true;
        }
    }
    
    // Show feedback
    feedbackDiv.classList.remove('alert-info', 'alert-warning', 'alert-danger', 'alert-success');
    
    if (conflicts > 0) {
        feedbackDiv.textContent = `❌ Conflict: Coach ${coach} already has a class during this time`;
        feedbackDiv.classList.add('alert-danger');
        feedbackDiv.classList.remove('d-none');
        return false;
    } else if (capacityIssues) {
        feedbackDiv.textContent = `⚠️ Warning: This would exceed the branch capacity (${maxBranchCapacity} classes)`;
        feedbackDiv.classList.add('alert-warning');
        feedbackDiv.classList.remove('d-none');
        return true; // Still allow but warn
    } else if (outsideBranchHours) {
        feedbackDiv.textContent = `❌ Error: Class would extend beyond branch operating hours`;
        feedbackDiv.classList.add('alert-danger');
        feedbackDiv.classList.remove('d-none');
        return false;
    } else {
        feedbackDiv.textContent = `✅ Available: This timeslot is available for Coach ${coach}`;
        feedbackDiv.classList.add('alert-success');
        feedbackDiv.classList.remove('d-none');
        return true;
    }
}

// Generate spare capacity display for a branch
async function generateSpareCapacitySection(branch, branchData, containerElement) {
    if (!containerElement) return;
    
    // Use cached branch capacities or default to 4
    const maxAllowed = branchCapacities[branch] || 4;
    
    // Create capacity object with day and timeslot structure
    const capacityByDayAndTime = {};
    
    // Initialize capacity structure for all days and timeslots
    days.forEach(day => {
        capacityByDayAndTime[day] = {};
        timeSlots.forEach(slot => {
            capacityByDayAndTime[day][slot] = {
                used: 0,
                spare: maxAllowed,
                available: isWithinOpeningHours(day, slot)
            };
        });
    });
    
    // Count used slots
    for (const day in branchData.schedule) {
        for (const coach in branchData.schedule[day]) {
            branchData.schedule[day][coach].forEach(classInfo => {
                if (!classInfo.start_time) return;
                
                const startIdx = timeSlots.indexOf(classInfo.start_time);
                const duration = classInfo.duration || 2;
                
                for (let i = 0; i < duration; i++) {
                    if ((startIdx + i) >= timeSlots.length) break;
                    
                    const slot = timeSlots[startIdx + i];
                    capacityByDayAndTime[day][slot].used++;
                    capacityByDayAndTime[day][slot].spare = maxAllowed - capacityByDayAndTime[day][slot].used;
                }
            });
        }
    }
    
    // Calculate week utilization
    const weekUtilization = calculateWeekUtilization(capacityByDayAndTime);
    
    // Create spare capacity display
    const branchCapacityDiv = document.createElement('div');
    branchCapacityDiv.className = 'capacity-details bg-dark text-white';
    
    // Branch title and legend
    const headerDiv = document.createElement('div');
    headerDiv.className = 'capacity-header';
    
    // Updated portion in generateSpareCapacitySection function
    const titleRow = document.createElement('div');
    titleRow.className = 'd-flex justify-content-between align-items-center';

    const branchTitle = document.createElement('h5');
    branchTitle.className = 'text-white mb-0';
    branchTitle.textContent = `${branch} - Available Capacity`;
    titleRow.appendChild(branchTitle);

    // Add week utilization badge with more spacing
    const utilizationBadge = document.createElement('span');
    utilizationBadge.className = 'week-utilization-badge badge';
    // Use the utility class directly instead of dynamic function
    utilizationBadge.classList.add(weekUtilization < 30 ? 'badge-danger' : weekUtilization < 60 ? 'badge-warning' : 'badge-success');
    utilizationBadge.textContent = `Week: ${weekUtilization}% Utilized`;
    titleRow.appendChild(utilizationBadge);

    headerDiv.appendChild(titleRow);
    
    // Add legend
    const legend = document.createElement('div');
    legend.className = 'capacity-legend';
    
    const highLegend = document.createElement('div');
    highLegend.className = 'legend-item';
    highLegend.innerHTML = '<span class="legend-color high-availability"></span> <span class="text-white">High Availability</span>';
    
    const mediumLegend = document.createElement('div');
    mediumLegend.className = 'legend-item';
    mediumLegend.innerHTML = '<span class="legend-color medium-availability"></span> <span class="text-white">Medium Availability</span>';
    
    const lowLegend = document.createElement('div');
    lowLegend.className = 'legend-item';
    lowLegend.innerHTML = '<span class="legend-color low-availability"></span> <span class="text-white">Low Availability (1 slot)</span>';
    
    const clickInfoLegend = document.createElement('div');
    clickInfoLegend.className = 'legend-item ms-auto';
    clickInfoLegend.innerHTML = '<small class="text-light"><i class="bi bi-info-circle"></i> Click on a timeslot to highlight it</small>';
    
    legend.appendChild(highLegend);
    legend.appendChild(mediumLegend);
    legend.appendChild(lowLegend);
    legend.appendChild(clickInfoLegend);
    
    headerDiv.appendChild(legend);
    branchCapacityDiv.appendChild(headerDiv);
    
    // Create days layout
    const daysList = document.createElement('div');
    daysList.className = 'row';
    
    for (const day of days) {
        const dayCol = document.createElement('div');
        dayCol.className = 'col-md-4 col-sm-6 mb-3';
        
        // Calculate day utilization
        const dayUtilization = calculateDayUtilization(day, capacityByDayAndTime);
        
        // Day header with utilization percentage
        const dayHeader = document.createElement('div');
        dayHeader.className = 'd-flex justify-content-between align-items-center mb-2';
        
        const dayTitle = document.createElement('h6');
        dayTitle.className = 'text-white m-0';
        dayTitle.textContent = day;
        dayHeader.appendChild(dayTitle);
        
        const utilizationBadge = document.createElement('span');
        utilizationBadge.className = `badge ${getUtilizationBadgeClass(dayUtilization)}`;
        utilizationBadge.textContent = `${dayUtilization}% Utilized`;
        dayHeader.appendChild(utilizationBadge);
        
        dayCol.appendChild(dayHeader);
        
        // Check if branch is closed on this day (should not happen since Monday is filtered out)
        if (!branchHours[day].open) {
            const closedNotice = document.createElement('div');
            closedNotice.className = 'closed-notice text-secondary';
            closedNotice.textContent = 'Branch Closed';
            dayCol.appendChild(closedNotice);
            daysList.appendChild(dayCol);
            continue;
        }
        
        // Find available 1-hour slots
        const availableHourSlots = findAvailableHourSlots(day, capacityByDayAndTime);
        
        if (availableHourSlots.length === 0) {
            const noSlotsMsg = document.createElement('div');
            noSlotsMsg.className = 'closed-notice text-secondary';
            noSlotsMsg.textContent = 'No available capacity';
            dayCol.appendChild(noSlotsMsg);
        } else {
            const slotsList = document.createElement('div');
            slotsList.className = 'capacity-list';
            
            // Add each available 1-hour slot
            availableHourSlots.forEach(slotInfo => {
                const slotBadge = document.createElement('span');
                
                // Style based on availability and lunch break
                if (slotInfo.isDuringLunch) {
                    slotBadge.className = 'capacity-badge badge lunch-break clickable-badge';
                } else if (slotInfo.spare === 1) {
                    slotBadge.className = 'capacity-badge badge low-availability clickable-badge';
                } else if (slotInfo.spare <= 3) {
                    slotBadge.className = 'capacity-badge badge medium-availability clickable-badge';
                } else {
                    slotBadge.className = 'capacity-badge badge high-availability clickable-badge';
                }
                
                // Add time range and spare slots
                slotBadge.textContent = `${formatTime(slotInfo.startSlot)}-${formatTime(slotInfo.endSlot)}: ${slotInfo.spare} slot${slotInfo.spare > 1 ? 's' : ''}`;
                
                // Add data attributes for click handling
                slotBadge.dataset.branch = branch;
                slotBadge.dataset.day = day;
                slotBadge.dataset.startSlot = slotInfo.startSlot;
                slotBadge.dataset.endSlot = slotInfo.endSlot;
                
                // Add click event handler
                slotBadge.addEventListener('click', handleTimeslotBadgeClick);
                
                slotsList.appendChild(slotBadge);
            });
            
            dayCol.appendChild(slotsList);
        }
        
        daysList.appendChild(dayCol);
    }
    
    branchCapacityDiv.appendChild(daysList);
    containerElement.appendChild(branchCapacityDiv);
}

// Check if a time is within branch opening hours
function isWithinOpeningHours(day, timeSlot) {
    const dayHours = branchHours[day];
    
    // If the branch is closed on this day
    if (!dayHours.open || !dayHours.close) {
        return false;
    }
    
    // Check if time is within operating hours
    if (timeSlot < dayHours.open || timeSlot >= dayHours.close) {
        return false;
    }
    
    // Check for lunch break (weekdays only: Tuesday to Friday)
    if (['Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)) {
        if (timeSlot >= lunchBreak.start && timeSlot < lunchBreak.end) {
            return false;
        }
    }
    
    return true;
}

// Check if a time is during lunch break
function isDuringLunchBreak(day, timeSlot) {
    if (!['Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day)) {
        return false;
    }
    
    return (timeSlot >= lunchBreak.start && timeSlot < lunchBreak.end);
}

// Get utilization badge class based on percentage
function getUtilizationBadgeClass(percentage) {
    if (percentage < 30) return 'badge-danger';
    if (percentage < 60) return 'badge-warning';
    return 'badge-success';
}

// Calculate the utilization percentage for a day
function calculateDayUtilization(day, capacityByDayAndTime) {
    let totalSlots = 0;
    let usedSlots = 0;
    
    // Count only slots within opening hours
    for (const slot in capacityByDayAndTime[day]) {
        if (capacityByDayAndTime[day][slot].available) {
            const maxAllowed = capacityByDayAndTime[day][slot].spare + capacityByDayAndTime[day][slot].used;
            totalSlots += maxAllowed;
            usedSlots += capacityByDayAndTime[day][slot].used;
        }
    }
    
    if (totalSlots === 0) return 0;
    return Math.round((usedSlots / totalSlots) * 100);
}

// Calculate the utilization percentage for the entire week (excluding Monday)
function calculateWeekUtilization(capacityByDayAndTime) {
    let totalSlots = 0;
    let usedSlots = 0;
    
    // Count all days except Monday
    for (const day of days) {
        for (const slot in capacityByDayAndTime[day]) {
            if (capacityByDayAndTime[day][slot].available) {
                const maxAllowed = capacityByDayAndTime[day][slot].spare + capacityByDayAndTime[day][slot].used;
                totalSlots += maxAllowed;
                usedSlots += capacityByDayAndTime[day][slot].used;
            }
        }
    }
    
    if (totalSlots === 0) return 0;
    return Math.round((usedSlots / totalSlots) * 100);
}

// Find available one-hour slots (2 consecutive 30-min slots)
function findAvailableHourSlots(day, capacityByDayAndTime) {
    const availableHourSlots = [];
    
    // Check each possible starting time slot
    for (let i = 0; i < timeSlots.length - 1; i++) {
        const startSlot = timeSlots[i];
        const endSlot = timeSlots[i + 1];
        
        // Check if both slots are available and have capacity
        if (capacityByDayAndTime[day][startSlot].available && 
            capacityByDayAndTime[day][startSlot].spare > 0 &&
            capacityByDayAndTime[day][endSlot].available && 
            capacityByDayAndTime[day][endSlot].spare > 0) {
            
            // Take the minimum spare capacity between the two slots
            const minSpare = Math.min(
                capacityByDayAndTime[day][startSlot].spare, 
                capacityByDayAndTime[day][endSlot].spare
            );
            
            availableHourSlots.push({
                startSlot: startSlot,
                endSlot: endSlot,
                spare: minSpare,
                isDuringLunch: isDuringLunchBreak(day, startSlot) || isDuringLunchBreak(day, endSlot)
            });
        }
    }
    
    return availableHourSlots;
}

// Function to handle clicking on a timeslot badge
function handleTimeslotBadgeClick(e) {
    const badge = e.currentTarget;
    const branch = badge.dataset.branch;
    const day = badge.dataset.day;
    const timeSlot = badge.dataset.startSlot;
    
    highlightTimeslot(branch, day, timeSlot);
}

// Highlight a timeslot in the timetable
function highlightTimeslot(branch, day, timeSlot) {
    // Clear any existing highlight
    clearHighlightedTimeslot();
    
    // If clicking the same slot, just clear it and return
    if (currentHighlightedSlot && 
        currentHighlightedSlot.branch === branch && 
        currentHighlightedSlot.day === day && 
        currentHighlightedSlot.timeSlot === timeSlot) {
        currentHighlightedSlot = null;
        return;
    }
    
    // Find the table for this branch
    const table = document.getElementById(`timetable-${branch}`);
    if (!table) return;
    
    // Highlight the day header for this day
    const dayHeaders = table.querySelectorAll(`th[data-day="${day}"]`);
    dayHeaders.forEach(header => {
        header.classList.add('highlighted-day');
    });
    
    // Find all cells for this time slot and day
    const rows = table.querySelectorAll(`tbody tr[data-time-slot="${timeSlot}"]`);
    if (!rows.length) return;
    
    // Store the currently highlighted slot info
    currentHighlightedSlot = { branch, day, timeSlot };
    
    rows.forEach(row => {
        // Get all cells for this day
        const cells = row.querySelectorAll(`td[data-day="${day}"]`);
        cells.forEach(cell => {
            cell.classList.add('highlighted-timeslot');
        });
        
        // Highlight the time cell
        const timeCell = row.querySelector('td.time-slot');
        if (timeCell) {
            timeCell.classList.add('highlighted-timeslot-time');
        }
    });
    
    // Scroll the row into view
    rows[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Clear any highlighted timeslot
function clearHighlightedTimeslot() {
    if (!currentHighlightedSlot) return;
    
    // Remove highlight classes
    document.querySelectorAll('.highlighted-timeslot, .highlighted-timeslot-time, .highlighted-day').forEach(element => {
        element.classList.remove('highlighted-timeslot', 'highlighted-timeslot-time', 'highlighted-day');
    });
}

// Drag and drop handlers
function handleDragStart(e) {
    this.classList.add('dragging');
    
    draggedData = {
        branch: this.dataset.branch,
        day: this.dataset.day,
        coach: this.dataset.coach,
        level: this.dataset.level,
        duration: this.dataset.duration,
        startIdx: this.dataset.startIdx
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(draggedData));
    e.dataTransfer.effectAllowed = 'move';
    
    // Show delete zone
    const deleteZone = document.getElementById('deleteZone');
    if (deleteZone) deleteZone.classList.add('active');
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Hide delete zone
    const deleteZone = document.getElementById('deleteZone');
    if (deleteZone) deleteZone.classList.remove('active');
    
    // Clear all drag effects
    document.querySelectorAll('.drag-valid, .drag-invalid').forEach(el => {
        el.classList.remove('drag-valid', 'drag-invalid');
    });
}

// Handle the style of the cells that the class block is being dragged over
function handleDragEnter(e) {
    e.preventDefault();

    if (e.target.classList.contains('class-cell')) {
        const valid = canDropAt(draggedData, e.target);
        e.target.classList.add(valid ? 'drag-valid' : 'drag-invalid');
    }
}

function handleDragLeave(e) {
    e.target.classList.remove('drag-valid', 'drag-invalid');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    e.preventDefault();

    if (!e.dataTransfer) return;

    const transferedData = JSON.parse(e.dataTransfer.getData('application/json'));
    const target = e.target.closest('.class-cell');

    if (!canDropAt(transferedData, target)) {
        // Cannot drop here
        return;
    }

    const { branch, day, coach } = target.dataset;
    const timeIdx = parseInt(target.dataset.timeIdx);
    
    // Store original branch for recalculating capacity
    const originalBranch = transferedData.branch;
    
    // Remove class from original position
    removeClass(originalBranch, transferedData.day, transferedData.coach, timeSlots[transferedData.startIdx]);
    
    // Add class to new position
    addClass(branch, day, coach, timeSlots[timeIdx], transferedData.level, transferedData.duration);
}

function canDropAt(draggedData, targetCell) {
    if (!draggedData || !targetCell) return false;
    
    const targetBranch = targetCell.dataset.branch;
    const targetDay = targetCell.dataset.day;
    const targetCoach = targetCell.dataset.coach;
    const targetTimeIdx = parseInt(targetCell.dataset.timeIdx);

    const { duration, day: classDay, branch: classBranch, coach: classCoach } = draggedData;
    const startIdx = parseInt(draggedData.startIdx);
    
    if (targetBranch !== classBranch) return false; 

    // Check if there's enough space
    for (let i = 0; i < duration; i++) {
        const nextCellIdx = targetTimeIdx + i;
        if (nextCellIdx >= timeSlots.length) return false;
        
        const selector = `.class-cell[data-branch="${targetBranch}"][data-day="${targetDay}"][data-coach="${targetCoach}"][data-time-idx="${nextCellIdx}"] .class-block`;
        const nextCell = document.querySelector(selector);

        if (targetDay === classDay && targetCoach === classCoach && nextCellIdx === startIdx) continue;

        if (nextCell) return false;
    }
    
    return true;
}

// Function to add parameter descriptions to the form fields
function addParameterDescriptions() {
    const formGroups = document.querySelectorAll('#collapseConfig .form-group');
    
    formGroups.forEach(group => {
        const label = group.querySelector('label');
        const input = group.querySelector('input');
        
        if (!label || !input || !input.id) return;
        
        // Check if description already exists
        if (group.querySelector('.form-text')) return;
        
        // Get description from the input's data attribute
        const description = input.dataset.description;
        
        if (description) {
            const descElement = document.createElement('small');
            descElement.className = 'form-text text-muted';
            descElement.textContent = description;
            group.appendChild(descElement);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const timetableDiv = document.getElementById('timetableDiv');
    const generate_btn = document.getElementById('generateBtn');
    const save_btn = document.getElementById('saveBtn');
    const deleteZone = document.getElementById('deleteZone');

    // Add parameter descriptions to the form fields
    addParameterDescriptions();

    // Set up delete zone
    if (deleteZone) {
        deleteZone.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            deleteZone.classList.add('dragover');
        });
        
        deleteZone.addEventListener('dragleave', () => {
            deleteZone.classList.remove('dragover');
        });
        
        deleteZone.addEventListener('drop', e => {
            e.preventDefault();
            deleteZone.classList.remove('dragover', 'active');
            
            if (draggedData) {
                // Get branch information for recalculating capacity
                const branch = draggedData.branch;
                
                // Remove the class
                removeClass(
                    branch, 
                    draggedData.day, 
                    draggedData.coach, 
                    timeSlots[draggedData.startIdx]
                );
            }
        });
    }

    // Add event listener for clicking outside of timeslot badges to clear highlights
    document.addEventListener('click', function(e) {
        // If we clicked on a non-badge and non-highlighted element, clear the highlight
        if (!e.target.closest('.clickable-badge') && !e.target.closest('.highlighted-timeslot') && 
            !e.target.closest('.highlighted-timeslot-time') && !e.target.closest('.highlighted-day')) {
            clearHighlightedTimeslot();
        }
    });

    // Set up modal button event listeners
    document.getElementById('addCoachSubmitBtn').addEventListener('click', function() {
        const branch = document.getElementById('coachBranchInput').value;
        const day = document.getElementById('coachDaySelect').value;
        const coach = document.getElementById('coachSelect').value;
        
        if (!coach) {
            alert('Please select a coach');
            return;
        }
        
        if (addCoachToDay(branch, day, coach)) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCoachModal'));
            modal.hide();
        }
    });
    
    // Add remove coach button event listener
    document.getElementById('removeCoachSubmitBtn').addEventListener('click', function() {
        const branch = document.getElementById('removeCoachBranchInput').value;
        const day = document.getElementById('removeCoachDayInput').value;
        const coach = document.getElementById('removeCoachSelect').value;
        
        if (!coach) {
            alert('Please select a coach to remove');
            return;
        }
        
        if (removeCoachFromDay(branch, day, coach)) {
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('removeCoachModal'));
            modal.hide();
        }
    });
    
    document.getElementById('checkAvailabilityBtn').addEventListener('click', checkAvailability);
    
    document.getElementById('addClassSubmitBtn').addEventListener('click', function() {
        // Check availability first
        if (checkAvailability()) {
            const branch = document.getElementById('classBranchInput').value;
            const day = document.getElementById('classDaySelect').value;
            const coach = document.getElementById('classCoachSelect').value;
            const level = document.getElementById('levelSelect').value;
            const startTime = document.getElementById('startTimeSelect').value;
            const duration = parseInt(document.getElementById('durationSelect').value);
            
            // Add the class
            addClass(branch, day, coach, startTime, level, duration);
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addClassModal'));
            modal.hide();
        }
    });

    generate_btn.addEventListener('click', async () => {
        timetableDiv.innerHTML = `
            <div class="d-flex justify-content-center align-items-center">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span class="ms-2">Generating timetable...</span>
            </div>`;

        const formEl = document.querySelector('#collapseConfig form');
        const formData = new FormData(formEl);
        const config = {};

        for (const [key, value] of formData.entries()) {
            // Convert to number if it looks numeric
            config[key] = isNaN(value) ? value : Number(value);
        }
        console.log(config);

        try {
            const response = await fetch(`/api/timetable/generate/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            
            const result = await response.json();
            if (!response.ok) {
                console.log(response);
                throw new Error(`Server returned ${response.status}: ${response.statusText}, ${result.message}`);
            }
            
            // Reset branch filter to make sure all branches are shown
            branchFilter = null;
            
            // Update data and render timetable
            data = result;
            renderTimetable(data);
        } catch (error) {
            console.error("Error generating timetable:", error);
            timetableDiv.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error:</strong> ${error.message || "Failed to generate timetable"}
                </div>
                <button id="retryBtn" class="btn btn-primary">Retry</button>
            `;
            
            document.getElementById('retryBtn')?.addEventListener('click', () => {
                generate_btn.click();
            });
        }
    });

    save_btn.addEventListener('click', async () => {
        if (!data || Object.keys(data).length === 0) {
            alert('No timetable data to save!');
            return;
        }

        console.log("Saving data:", data);

        try {
            const response = await fetch('/api/timetable/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('Timetable saved successfully!');
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error saving timetable:', error);
            alert('Error saving timetable. Please try again.');
        }
    });

    // Fetch branch capacities and coaches on initial load
    try {
        const [branchResponse, coachResponse] = await Promise.allSettled([
            fetch('/api/branch/'),
            fetchCoachesFromDatabase()
        ]);
        
        if (branchResponse.status === 'fulfilled' && branchResponse.value.ok) {
            const result = await branchResponse.value.json();
            if (result.success) {
                result.branches.forEach(branch => {
                    branchCapacities[branch.abbrv] = branch.max_classes;
                });
            }
        }
    } catch (error) {
        console.error('Error during initial data fetch:', error);
    }
    
    // Fetch any existing timetable data
    try {
        const response = await fetch('/api/timetable/latest/');
        const result = await response.json();
        
        if (response.ok && result) {
            data = result;
            renderTimetable(data);
        }
    } catch (error) {
        console.error('Error fetching latest timetable:', error);
    }
});