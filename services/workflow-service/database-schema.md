# Workflow Database Schema

Tables:

workflows
- id
- customer_id
- state
- created_at
- updated_at

workflow_history
- id
- workflow_id
- old_state
- new_state
- actor_id
- created_at

workflow_events
- id
- workflow_id
- event_name
- payload
- created_at
