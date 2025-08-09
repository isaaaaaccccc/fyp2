from flask import Blueprint, render_template, request, flash, redirect, jsonify, get_flashed_messages, url_for
from application import db, bcrypt
from application.models import User
from flask_login import login_user, logout_user, login_required
from application.forms import CoachFilter, CoachDetails, DataUploadForm, BranchFilter, BranchForm, AlgorithmConfig
from application.models import Coach, Level, Branch, CoachBranch, CoachOffday, CoachPreference
from application.util import format_schedule_for_display, process_level_config_file, process_availability_file, process_branch_config_file, process_coaches_file, process_enrollment_file, process_popular_timeslots_file, transform_schedule_for_timetable_js, generate_sample_timetable

pages_bp = Blueprint('pages', __name__)

@pages_bp.route('/')
def index():
    return render_template('index.html')

@pages_bp.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@pages_bp.route('/timetable')
def timetable():
    return render_template('timetable.html', configForm=AlgorithmConfig())

@pages_bp.route('/database/coach')
def coach_db():
    return render_template('coach.html', filter=CoachFilter(), details=CoachDetails())

@pages_bp.route('/database/branch')
def branch_db():
    """Branch management page"""
    # Create instances of our forms
    filter_form = BranchFilter()
    branch_form = BranchForm()
    
    # Get all branches for initial display (actual filtering is handled via JavaScript)
    branches = Branch.query.all()
    
    return render_template(
        'branch.html',
        title='Branch Management',
        branches=branches,
        filter=filter_form,
        form=branch_form
    )

@pages_bp.route('/database/timetable')
def timetable_db():
    return render_template('timetable_db.html')

@pages_bp.route('/database/data-upload', methods=['GET', 'POST'])
def data_upload():
    form = DataUploadForm()
    
    if request.method == 'GET':
        return render_template('data_upload.html', form=form)
    
    # Handle POST request
    print("Data upload request received")
    print(f"Request files: {list(request.files.keys())}")
    print(f"Form validation: {form.validate_on_submit()}")
    
    # Check if this is an AJAX request
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.content_type == 'application/json'
    
    if not form.validate_on_submit():
        print(f"Form validation failed: {form.errors}")
        if is_ajax:
            return jsonify({
                'success': False,
                'message': 'Form validation failed. Please check your files and try again.',
                'errors': form.errors
            }), 400
        else:
            flash('Form validation failed. Please check your files and try again.', 'error')
            return render_template('data_upload.html', form=form)
    
    try:
        upload_results = []
        processed_files = []
        
        print("Form validation passed, processing files...")
        
        # Process each file type
        file_processors = [
            ('level_config_file', process_level_config_file),
            ('branch_config_file', process_branch_config_file),
            ('coaches_file', process_coaches_file),
            ('availability_file', process_availability_file),
            ('enrollment_file', process_enrollment_file),
            ('popular_timeslots_file', process_popular_timeslots_file)
        ]
        
        for field_name, processor_func in file_processors:
            field = getattr(form, field_name)
            if field.data and hasattr(field.data, 'filename') and field.data.filename:
                try:
                    print(f"Processing {field_name}: {field.data.filename}")
                    # Reset file pointer to beginning
                    field.data.seek(0)
                    result = processor_func(field.data)
                    upload_results.append(result)
                    processed_files.append({
                        'field': field_name,
                        'filename': field.data.filename,
                        'result': result
                    })
                    print(f"{field_name} result: {result}")
                except Exception as e:
                    print(f"Error processing {field_name}: {str(e)}")
                    raise Exception(f"Error processing {field.data.filename}: {str(e)}")
        
        if upload_results:
            # Commit all changes
            db.session.commit()
            success_message = f'Successfully processed {len(upload_results)} file(s)!'
            print(f"{success_message}")
            
            if is_ajax:
                return jsonify({
                    'success': True,
                    'message': success_message,
                    'processed_files': processed_files,
                    'file_count': len(upload_results)
                })
            else:
                flash(success_message, 'success')
                return redirect(url_for('pages.data_upload'))
        else:
            error_message = 'No files were uploaded. Please select at least one CSV file.'
            print(f"{error_message}")
            
            if is_ajax:
                return jsonify({
                    'success': False,
                    'message': error_message,
                    'processed_files': [],
                    'file_count': 0
                }), 400
            else:
                flash(error_message, 'warning')
                return render_template('data_upload.html', form=form)
                
    except Exception as e:
        db.session.rollback()
        error_msg = f'Error processing files: {str(e)}'
        print(f"Exception occurred: {error_msg}")
        import traceback
        traceback.print_exc()
        
        if is_ajax:
            return jsonify({
                'success': False,
                'message': error_msg,
                'processed_files': [],
                'file_count': 0
            }), 500
        else:
            flash(error_msg, 'error')
            return render_template('data_upload.html', form=form)