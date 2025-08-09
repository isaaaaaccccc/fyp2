from flask import Blueprint, render_template, request, jsonify, flash, send_file
from flask_login import login_required
from application.data_processor import load_database_driven
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict
import random
import io
import os

timetable_bp = Blueprint('timetable', __name__, url_prefix='/timetable')

@timetable_bp.route('/generate-schedule', methods=['POST'])
@login_required
def generate_schedule():
    """Generate complete timetable schedule from database"""
    try:
        print("🚀 Starting complete timetable generation from database...")
        
        # Load data from database
        data = load_database_driven()
        
        # Execute scheduling algorithm
        from application.enhanced_scheduler import execute_enhanced_strict_constraint_scheduling
        results = execute_enhanced_strict_constraint_scheduling(data)
        
        # Convert to display format
        display_schedule = convert_to_display_format(results)
        
        # Save to CSV
        csv_filename = save_schedule_to_csv(display_schedule)
        
        return jsonify({
            'success': True,
            'message': 'Timetable generated successfully',
            'statistics': results['statistics'],
            'csv_filename': csv_filename,
            'schedule_preview': display_schedule[:10]  # First 10 entries for preview
        })
        
    except Exception as e:
        import traceback
        error_msg = f"Error generating timetable: {str(e)}"
        print(f"❌ {error_msg}")
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'message': error_msg,
            'error': str(e)
        }), 500

@timetable_bp.route('/download-schedule/<filename>')
@login_required
def download_schedule(filename):
    """Download generated schedule CSV"""
    try:
        file_path = os.path.join('generated_schedules', filename)
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True, download_name=filename)
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@timetable_bp.route('/view-schedule')
@login_required
def view_schedule():
    """View the timetable schedule page"""
    return render_template('timetable.html')

def convert_to_display_format(results):
    """Convert scheduler output to display format"""
    display_schedule = []
    
    for entry in results['schedule']:
        # Map day names to full names
        day_mapping = {
            'TUE': 'Tuesday',
            'WED': 'Wednesday', 
            'THU': 'Thursday',
            'FRI': 'Friday',
            'SAT': 'Saturday',
            'SUN': 'Sunday'
        }
        
        display_entry = {
            'Branch': entry['Branch'],
            'Day': day_mapping.get(entry['Day'], entry['Day']),
            'Time': f"{entry['Start Time']} - {entry['End Time']}",
            'Level': entry['Gymnastics Level'],
            'Coach': entry['Coach Name'],
            'Coach Status': entry['Coach Status'],
            'Students': entry['Students'],
            'Capacity': entry['Capacity'],
            'Duration': f"{entry['Duration (min)']} min",
            'Popular Slot': entry['Popular Slot'],
            'Merged': entry['Merged'],
            'Merged With': entry.get('Merged With', ''),
            
            # Additional fields for sorting and filtering
            'Start Time': entry['Start Time'],
            'End Time': entry['End Time'],
            'Day Code': entry['Day'],
            'Coach ID': entry['Coach ID']
        }
        
        display_schedule.append(display_entry)
    
    return display_schedule

def save_schedule_to_csv(schedule):
    """Save schedule to CSV file"""
    # Create directory if it doesn't exist
    os.makedirs('generated_schedules', exist_ok=True)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'timetable_schedule_{timestamp}.csv'
    filepath = os.path.join('generated_schedules', filename)
    
    # Convert to DataFrame and save
    df = pd.DataFrame(schedule)
    
    # Reorder columns for better readability
    column_order = [
        'Branch', 'Day', 'Time', 'Level', 'Coach', 'Coach Status',
        'Students', 'Capacity', 'Duration', 'Popular Slot', 'Merged', 'Merged With'
    ]
    
    # Select only the columns that exist
    available_columns = [col for col in column_order if col in df.columns]
    df_ordered = df[available_columns]
    
    df_ordered.to_csv(filepath, index=False)
    
    print(f"Schedule saved to: {filepath}")
    return filename