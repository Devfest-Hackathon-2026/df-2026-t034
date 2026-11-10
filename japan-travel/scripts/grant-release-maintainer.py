"""Owner-only, review-first IAM helper for the existing team project.
Default is dry-run. --apply requires a project administrator already signed in.
This does not enable paid APIs, create keys/secrets or modify the running service.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--member', required=True, help='user:ACCOUNT_EMAIL (never a password or key)')
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
if not args.member.startswith('user:') or '@' not in args.member or any(c.isspace() for c in args.member):
    parser.error('Expected user:ACCOUNT_EMAIL')
project = 'gen-lang-client-0217481921'
region = 'asia-northeast1'
service = 'japan-travel-chat'
member = args.member
roles = {
    'travelChatServiceUpdater': ['run.services.get', 'run.services.update', 'run.revisions.get', 'run.revisions.list', 'run.configurations.get', 'run.configurations.list', 'run.routes.get', 'run.routes.list'],
    'travelChatReleaseSubmitter': ['cloudbuild.builds.create', 'cloudbuild.builds.get', 'cloudbuild.builds.list', 'cloudbuild.builds.update', 'cloudbuild.locations.get', 'cloudbuild.locations.list', 'cloudbuild.operations.get', 'cloudbuild.operations.list', 'run.operations.get', 'run.operations.list', 'resourcemanager.projects.get', 'serviceusage.services.get', 'serviceusage.services.list', 'serviceusage.services.use', 'datastore.databases.getMetadata'],
    'travelChatSourcePublisher': ['storage.buckets.get', 'storage.objects.create', 'storage.objects.get', 'storage.objects.list'],
}

def run(arguments):
    output = subprocess.check_output(['gcloud', *arguments, '--format=json', '--quiet'], text=True)
    return json.loads(output) if output.strip() else {}

def mutate(arguments):
    if not args.apply:
        print(json.dumps({'planned': ['gcloud', *arguments]}, ensure_ascii=False))
        return
    run(arguments)
    print(json.dumps({'applied': arguments[:3]}, ensure_ascii=False))

if args.apply:
    # Fail before mutations if the owner is not in the intended project.
    info = run(['projects', 'describe', project])
    assert str(info.get('projectNumber')) == '14289984868', 'Unexpected team project'
    run(['run', 'services', 'describe', service, '--project='+project, '--region='+region])

with tempfile.TemporaryDirectory() as temporary:
    for role, permissions in roles.items():
        filename = Path(temporary) / (role+'.json')
        filename.write_text(json.dumps({'title':role, 'description':'Team travel chat scoped release maintenance. No billing, API enablement or secret/key administration.', 'stage':'GA', 'includedPermissions':permissions}))
        if args.apply:
            try:
                existing = run(['iam', 'roles', 'describe', role, '--project='+project])
            except subprocess.CalledProcessError:
                mutate(['iam', 'roles', 'create', role, '--project='+project, '--file='+str(filename)])
            else:
                assert set(existing.get('includedPermissions', [])) == set(permissions), 'Existing role differs; owner must review instead of overwriting'
        else:
            print(json.dumps({'role':role,'project':project,'permissions':permissions}))

    mutate(['projects','add-iam-policy-binding',project,'--member='+member,'--role=projects/'+project+'/roles/travelChatReleaseSubmitter','--condition=None'])
    mutate(['run','services','add-iam-policy-binding',service,'--project='+project,'--region='+region,'--member='+member,'--role=projects/'+project+'/roles/travelChatServiceUpdater'])
    mutate(['storage','buckets','add-iam-policy-binding','gs://'+project+'-travel-build','--member='+member,'--role=projects/'+project+'/roles/travelChatSourcePublisher'])
    mutate(['artifacts','repositories','add-iam-policy-binding','travel-chat','--project='+project,'--location='+region,'--member='+member,'--role=roles/artifactregistry.reader'])
    for account in ['travel-chat-build','travel-chat-runtime']:
        mutate(['iam','service-accounts','add-iam-policy-binding',account+'@'+project+'.iam.gserviceaccount.com','--project='+project,'--member='+member,'--role=roles/iam.serviceAccountUser'])
    views = {
        'japan-travel-chat-runtime': 'resource.type="cloud_run_revision" AND resource.labels.service_name="japan-travel-chat" AND resource.labels.location="asia-northeast1"',
        'japan-travel-chat-builds': 'resource.type="build"',
    }
    for name, log_filter in views.items():
        base = ['--project='+project, '--bucket=_Default', '--location=global']
        if args.apply:
            try:
                existing = run(['logging','views','describe',name,*base])
            except subprocess.CalledProcessError:
                mutate(['logging','views','create',name,*base,'--log-filter='+log_filter])
            else:
                assert existing.get('filter') == log_filter, 'Existing log filter differs; do not expand it automatically'
        else:
            print(json.dumps({'plannedLogView':name,'filter':log_filter}))
        mutate(['logging','views','add-iam-policy-binding',name,*base,'--member='+member,'--role=roles/logging.viewAccessor'])

print(json.dumps({'applied':args.apply,'project':project,'member':member,'note':'Owner must read back all bindings after propagation. No runtime secret or API changes were performed.'}))
