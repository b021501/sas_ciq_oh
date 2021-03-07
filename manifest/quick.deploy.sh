#!/bin/bash
# Apply bnsf_manifest.yaml to create the needed Deployment and Service
# BNSF URL is viya.sasviya.bnsf.com (not sure what the namespace is. Guessing viya)

kubectl -n viya apply -f https://raw.githubusercontent.com/maperrsas/sas_ciq_oh/main/manifest/bnsf_manifest.yaml

# Create a manifest to define the Ingress resource
cat << EOF > /tmp/bnsf-ingress.yaml
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: bnsf-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
    - host: viya.$(hostname -f)
      http:
        paths:
          - backend:
              serviceName: bnsf-service
              servicePort: 3000
            path: /bnsf
EOF

# Apply the newly yaml file
kubectl apply -f /tmp/bnsf-ingress.yaml -n viya

# Print the URL of the web application
printf "URL for BNSF ingress: http://viya.$(hostname -f)/bnsf \n"