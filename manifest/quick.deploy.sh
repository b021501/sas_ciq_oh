#!/bin/bash
# Apply bnsf_manifest.yaml to create the needed Deployment and Service

kubectl -n big apply -f https://raw.githubusercontent.com/xavierBizoux/ddc-container/master/manifest/ddc_manifest.yaml

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
    - host: big.$(hostname -f)
      http:
        paths:
          - backend:
              serviceName: bnsf-service
              servicePort: 3000
            path: /bnsf
EOF

# Apply the newly yaml file
kubectl apply -f /tmp/bnsf-ingress.yaml -n big

# Print the URL of the web application
printf "URL for BNSF ingress: http://big.$(hostname -f)/bnsf \n"