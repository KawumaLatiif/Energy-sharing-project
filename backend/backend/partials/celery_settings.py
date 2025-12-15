import os
# from datetime import timedelta
# from celery.schedules import crontab
from kombu import Exchange, Queue
from meteringapi.settings_utils import get_env_variable


CELERY_BROKER_URL = get_env_variable("CELERY_BROKER_URL", default="redis://redis:6379/0")

# Where to store task return values, by default we turn it off
CELERY_RESULT_BACKEND = get_env_variable(
    "CELERY_RESULT_BACKEND", default="redis://redis:6379/0"
)

CELERY_TASK_IGNORE_RESULT = True

# For testing, when True all "delayed" task execute locally and blocking
CELERY_TASK_ALWAYS_EAGER = get_env_variable("CELERY_TASK_ALWAYS_EAGER", allow_none=True, default=False)
CELERY_ACCEPT_CONTENT = ["application/json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = get_env_variable("CELERY_TIMEZONE", default="Africa/Nairobi")

# tasks without priority queues are added to the default celery queue
task_routing = [
    ("accounts.tasks.add_task", "low"),
    ("accounts.tasks.retry", "high"),

]

# TASK QUEUES
task_queues = [
    Queue(qname, Exchange(qname)) for qname in set(dict(task_routing).values())
]
# add celery queue to the task queues
task_queues.append(Queue("celery"))
CELERY_TASK_QUEUES = task_queues


# TASK ROUTES
def route_for_task(name, *args, **kwargs):
    """
    A router is a function that decides the routing options for a task
    """
    for task_name, qname in task_routing:
        if name.startswith(task_name):
            return {"queue": qname}
    return {"queue": "celery"}


# Route tasks by name to the queues and rules defined above
CELERY_TASK_ROUTES = (route_for_task,)

# Celery beat tasks that run on a schedule
CELERY_BEAT_SCHEDULE = {
    # 'task_name': {
    #     'task': 'testapp.tasks.task_name',
    #     'schedule': crontab(minute="*/1")  # every minute
    #     'schedule': timedelta(seconds=5),  # for seconds
    # },
}
