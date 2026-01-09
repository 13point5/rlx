# Prime Intellect API Documentation

> **Base URL:** `https://api.primeintellect.ai`
>
> **Inference API Base URL:** `https://api.pinference.ai/api/v1`

The Prime Intellect API provides a powerful and flexible solution for managing and scaling cloud-based GPU instances across various GPU providers. This API enables you to create, manage, and monitor instances with seamless access to a wide array of customizable resources, including GPU configurations, storage, and more.

---

## Table of Contents

- [API Documentation](#api-documentation)
  - [API Overview](#api-overview)
  - [API Keys](#api-keys)
- [Compute API](#compute-api)
  - [Get Availability Information](#get-availability-information)
  - [Provision Instance](#provision-instance)
  - [Managing Pods](#managing-pods)
  - [Managing Disks](#managing-disks)
- [Inference API](#inference-api)
  - [Models](#models)
  - [Chat Completions](#chat-completions)
- [Availability](#availability)
  - [GET Get Legacy GPU Availability](#get-get-legacy-gpu-availability)
  - [GET Get Legacy Cluster Availability](#get-get-legacy-cluster-availability)
  - [GET Get Disks Availability](#get-get-disks-availability)
  - [GET Get GPU Summary](#get-get-gpu-summary)
  - [GET Get GPU Availability](#get-get-gpu-availability)
  - [GET Get Multinode Availability](#get-get-multinode-availability)
  - [GET Get Multinode Summary](#get-get-multinode-summary)
- [Disks](#disks)
  - [GET List Disks](#get-list-disks)
  - [POST Create Disk](#post-create-disk)
  - [GET Get Disk](#get-get-disk)
  - [DELETE Delete Disk](#delete-delete-disk)
  - [PATCH Update Disk](#patch-update-disk)
- [Evals](#evals)
  - [GET List Evaluations](#get-list-evaluations)
  - [POST Create Evaluation](#post-create-evaluation)
  - [GET Get Evaluation](#get-get-evaluation)
  - [PUT Update Evaluation](#put-update-evaluation)
  - [DELETE Delete Evaluation](#delete-delete-evaluation)
  - [POST Finalize Evaluation](#post-finalize-evaluation)
  - [GET Get Samples](#get-get-samples)
  - [POST Push Samples](#post-push-samples)
- [Images](#images)
  - [GET List User Images](#get-list-user-images)
  - [POST Initiate Image Build](#post-initiate-image-build)
  - [GET Get Build Status](#get-get-build-status)
  - [POST Start Image Build](#post-start-image-build)
  - [GET List Image Builds](#get-list-image-builds)
  - [DELETE Delete User Image](#delete-delete-user-image)
- [Pods](#pods)
  - [GET Get Pods](#get-get-pods)
  - [POST Create Pod](#post-create-pod)
  - [GET Get Pods History](#get-get-pods-history)
  - [GET Get Pods Status](#get-get-pods-status)
  - [GET Get Pod](#get-get-pod)
  - [DELETE Delete Pod](#delete-delete-pod)
  - [GET Get Pod Logs Api](#get-get-pod-logs-api)
- [Sandbox](#sandbox)
  - [GET List Sandboxes](#get-list-sandboxes)
  - [POST Create Sandbox Endpoint](#post-create-sandbox-endpoint)
  - [DELETE Bulk Delete Sandboxes Endpoint](#delete-bulk-delete-sandboxes-endpoint)
  - [GET List All Exposed Ports Endpoint](#get-list-all-exposed-ports-endpoint)
  - [GET Get Sandbox Endpoint](#get-get-sandbox-endpoint)
  - [DELETE Delete Sandbox Endpoint](#delete-delete-sandbox-endpoint)
  - [POST Get Sandbox Auth Token](#post-get-sandbox-auth-token)
  - [GET List Exposed Ports Endpoint](#get-list-exposed-ports-endpoint)
  - [POST Expose Port Endpoint](#post-expose-port-endpoint)
  - [DELETE Unexpose Port Endpoint](#delete-unexpose-port-endpoint)
  - [GET Get Sandbox Logs Endpoint](#get-get-sandbox-logs-endpoint)
- [SSH Keys](#ssh-keys)
  - [GET Get SSH Keys](#get-get-ssh-keys)
  - [POST Upload SSH Key](#post-upload-ssh-key)
  - [DELETE Delete SSH Key](#delete-delete-ssh-key)
  - [PATCH Set Primary Key](#patch-set-primary-key)
- [Template](#template)
  - [POST Check Docker Image](#post-check-docker-image)
  - [GET List Registry Credentials](#get-list-registry-credentials)
- [User](#user)
  - [PATCH Set Username Slug](#patch-set-username-slug)
  - [GET List My Teams](#get-list-my-teams)
  - [GET Get Whoami](#get-get-whoami)

---

# API Documentation

## API Overview

Plug into the cheapest compute for your applications and workflows.

The Prime Intellect API provides a powerful and flexible solution for managing and scaling cloud-based GPU instances across various GPU providers. This API enables you to create, manage, and monitor instances with seamless access to a wide array of customizable resources, including GPU configurations, storage, and more.

### Quick Start

Get started by setting up an API Key with the necessary permissions for your intended actions, whether retrieving instance data or managing resources. The API documentation provides step-by-step examples, including how to:

- **Check GPU availability** - View current GPU resources, specifications, and availability across different providers to find the best fit for your needs.
- **Provision your first GPU** - Quickly set up and deploy a GPU instance with easy-to-follow steps.
- **Manage your instances** - Monitor and control all your active GPU instances in one place.
- **Manage persistent storage** - Create and manage network-attached disks for persistent data storage across instances.

---

## API Keys

How to generate and use authentication keys with our API.

### Overview

This guide explains how to generate and manage API keys for authenticating requests to our API. Proper use of API keys is critical for securing your application and controlling access.

### Generating an API Key

To generate API Key, navigate to **Settings -> API Keys**, and click the **Generate New Key +** button.

You can assign fine-grained permissions to each key, allowing you to create multiple keys with specific scopes or roles. This enhances the security of your application by limiting each key's responsibilities. Additionally, you can set an expiration date for each key. We strongly recommend always setting an expiration date to avoid using indefinitely valid keys.

> **Important:** Ensure that all API keys are stored securely and never shared in untrusted environments or with third-party applications.

Once a key is generated, you will be able to copy it for immediate use.

> **Warning:** The key value is displayed only once. If you lose it, you will not be able to retrieve it again.

### Revoking an API Key

If you no longer need a particular API key go to **Settings -> API Keys**, find your key on the list and click on **Remove** button on the right side.

---

# Compute API

## Get Availability Information

How to check GPU, cluster, and disk availability and pricing.

> **Before you start:** Ensure that you have API Key with **Availability -> Read** permission

### Available Endpoints

The availability API provides two endpoints to query different types of resources:

- `/api/v1/availability/gpus` - Get GPU instance availability
- `/api/v1/availability/disks` - Get standalone disk availability

### Retrieving GPU Availability Data

Suppose you want to check pricing options for a single H100 GPU, with the location restricted to the United States or Canada. To do this, send a request to our availability endpoint as shown below:

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/availability/gpus?regions=united_states&regions=canada&gpu_count=1&gpu_type=H100_80GB' \
  --header 'Authorization: Bearer your_api_key'
```

### Query Parameters

| Parameter      | Type         | Description                                                    |
| -------------- | ------------ | -------------------------------------------------------------- |
| regions        | List[string] | Filter by region(s) (e.g., united_states, canada, europe_west) |
| gpu_count      | integer      | Desired number of GPUs                                         |
| gpu_type       | string       | GPU model (e.g., H100_80GB, A100_80GB)                         |
| socket         | string       | GPU socket type (e.g., PCIe, SXM)                              |
| security       | string       | Security type: secure_cloud or community_cloud                 |
| data_center_id | string       | Filter by specific data center ID                              |
| cloud_id       | string       | Filter by provider's cloud ID                                  |
| disks          | List[string] | Filter by disk IDs                                             |
| page           | integer      | Page number (default: 1, min: 1)                               |
| page_size      | integer      | Results per page (default: 100, max: 100)                      |

### Example Response

```json
{
  "items": [
    {
      "cloudId": "NVIDIA H100 PCIe",
      "gpuType": "H100_80GB",
      "socket": "PCIe",
      "provider": "runpod",
      "region": "united_states",
      "dataCenter": "US-KS-2",
      "country": "US",
      "gpuCount": 1,
      "gpuMemory": 80,
      "disk": {
        "minCount": 80,
        "defaultCount": 80,
        "maxCount": 1000,
        "pricePerUnit": 0.00014,
        "step": 1,
        "defaultIncludedInPrice": false,
        "additionalInfo": null
      },
      "vcpu": {
        "defaultCount": 16
      },
      "memory": {
        "defaultCount": 251
      },
      "stockStatus": "Low",
      "security": "secure_cloud",
      "prices": {
        "onDemand": 2.69,
        "communityPrice": null,
        "isVariable": false,
        "currency": "USD"
      },
      "images": [
        "ubuntu_22_cuda_12",
        "cuda_12_1_pytorch_2_2",
        "cuda_11_8_pytorch_2_1"
      ]
    }
  ],
  "totalCount": 247
}
```

### Response Fields

- **provider** - The company or platform providing the GPU
- **cloudId** - Unique identifier required for provisioning
- **region** - Geographic region (e.g., united_states, europe_west)
- **dataCenter** - Optional, specifies the data center location
- **disk, vcpu, memory** - Resource specifications with min/max/default values
- **prices** - Pricing information (onDemand for secure_cloud, communityPrice for community_cloud)

### Cost Calculation Example

```
GPU cost: $2.69
vcpu cost: $0.00
memory cost: $0.00
disk cost: $0.0112 (80 units * $0.00014)

Total cost: $2.7012
```

### Checking Disk Availability

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/availability/disks?regions=united_states&page=1&page_size=50' \
  --header 'Authorization: Bearer your_api_key'
```

---

## Provision Instance

How to provision an instance using availability data.

> **Before you start:** Ensure that you have API Key with **Instances -> Read and write** permission

### Creating the Instance Request Body

The request requires a body with `pod`, `provider` and optional `team` definitions.

#### Pod Configuration

```json
{
  "pod": {
    "name": "My first pod",
    "cloudId": "n3-H100x1",
    "gpuType": "H100_80GB",
    "socket": "PCIe",
    "gpuCount": 1,
    "image": "ubuntu_22_cuda_12",
    "dataCenterId": "CANADA-1",
    "country": "CA",
    "security": "secure_cloud"
  },
  "provider": {
    "type": "hyperstack"
  }
}
```

### Sending the Create Request

```bash
curl --request POST \
  --url https://api.primeintellect.ai/api/v1/pods/ \
  --header 'Authorization: Bearer your_api_key' \
  --header 'Content-Type: application/json' \
  --data '{
  "pod": {
    "name": "My first pod",
    "cloudId": "n3-H100x1",
    "gpuType": "H100_80GB",
    "socket": "PCIe",
    "gpuCount": 1,
    "image": "ubuntu_22_cuda_12",
    "dataCenterId": "CANADA-1",
    "country": "CA",
    "security": "secure_cloud"
  },
  "provider": {
    "type": "hyperstack"
  }
}'
```

### Modifying Instance Resources

To increase disk size:

```bash
curl --request POST \
  --url https://api.primeintellect.ai/api/v1/pods/ \
  --header 'Authorization: Bearer your_api_key' \
  --header 'Content-Type: application/json' \
  --data '{
  "pod": {
    "name": "My first pod",
    "cloudId": "n3-H100x1",
    "gpuType": "H100_80GB",
    "socket": "PCIe",
    "gpuCount": 1,
    "image": "ubuntu_22_cuda_12",
    "dataCenterId": "CANADA-1",
    "country": "CA",
    "security": "secure_cloud",
    "diskSize": 200
  },
  "provider": {
    "type": "hyperstack"
  }
}'
```

### Using Custom Templates

```bash
curl --request POST \
  --url https://api.primeintellect.ai/api/v1/pods/ \
  --header 'Authorization: Bearer your_api_key' \
  --header 'Content-Type: application/json' \
  --data '{
  "pod": {
    "name": "My first pod",
    "cloudId": "n3-H100x1",
    "gpuType": "H100_80GB",
    "socket": "PCIe",
    "gpuCount": 1,
    "image": "custom_template",
    "customTemplateId": "cm2szl4a20001tl3pyq7ua6o7",
    "dataCenterId": "CANADA-1",
    "country": "CA",
    "security": "secure_cloud"
  },
  "provider": {
    "type": "hyperstack"
  }
}'
```

### Attaching Existing Disks

```bash
curl --request POST \
  --url https://api.primeintellect.ai/api/v1/pods/ \
  --header 'Authorization: Bearer your_api_key' \
  --header 'Content-Type: application/json' \
  --data '{
  "pod": {
    "name": "Training instance with data",
    "cloudId": "n3-H100x1",
    "gpuType": "H100_80GB",
    "socket": "PCIe",
    "gpuCount": 1,
    "image": "ubuntu_22_cuda_12",
    "dataCenterId": "CANADA-1",
    "security": "secure_cloud"
  },
  "provider": {
    "type": "hyperstack"
  },
  "disks": ["clhxy6aw80000j8080gdf8kqv"]
}'
```

---

## Managing Pods

How to get pods, statuses and delete instances.

> **Before you start:** Ensure that you have API Key with **Instances -> Read** permission (or **Read and Write** if you want to Delete instances)

### Retrieving Existing Pods

```bash
curl --request GET \
  --url https://api.primeintellect.ai/api/v1/pods/ \
  --header 'Authorization: Bearer your_api_key'
```

With pagination:

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/pods/?offset=0&limit=10' \
  --header 'Authorization: Bearer your_api_key'
```

### Retrieving a Specific Pod

```bash
curl --request GET \
  --url https://api.primeintellect.ai/api/v1/pods/my_pod_id \
  --header 'Authorization: Bearer your_api_key'
```

### Checking Pod Status

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/pods/status/?pod_ids=my_first_pod_id&pod_ids=my_second_pod_id' \
  --header 'Authorization: Bearer your_api_key'
```

Example response:

```json
{
  "podId": "my_first_pod_id",
  "providerType": "primecompute",
  "status": "ACTIVE",
  "sshConnection": "root@135.23.125.123 -p 22",
  "costPerHr": 3.52,
  "primePortMapping": [
    {
      "internal": "22",
      "external": "22",
      "protocol": "TCP",
      "usedBy": "SSH",
      "description": ""
    }
  ],
  "ip": "135.23.125.123",
  "installationFailure": null,
  "installationProgress": 100
}
```

### Deleting a Pod

```bash
curl --request DELETE \
  --url https://api.primeintellect.ai/api/v1/pods/my_pod_id \
  --header 'Authorization: Bearer your_api_key'
```

---

## Managing Disks

How to create and manage network-attached storage disks.

> **Before you start:** Ensure that you have API Key with **Disks -> Read and write** permission

### Creating a Disk

```bash
curl --request POST \
  --url https://api.primeintellect.ai/api/v1/disks/ \
  --header 'Authorization: Bearer your_api_key' \
  --header 'Content-Type: application/json' \
  --data '{
  "disk": {
    "size": 500,
    "name": "ml-training-data",
    "dataCenterId": "US-1"
  },
  "provider": {
    "type": "hyperstack"
  }
}'
```

### Listing Your Disks

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/disks/?limit=50&offset=0' \
  --header 'Authorization: Bearer your_api_key'
```

### Getting a Single Disk

```bash
curl --request GET \
  --url https://api.primeintellect.ai/api/v1/disks/fdb5205fd9b14c9d804d3f70b4c96da0 \
  --header 'Authorization: Bearer your_api_key'
```

### Updating a Disk

```bash
curl --request PATCH \
  --url https://api.primeintellect.ai/api/v1/disks/fdb5205fd9b14c9d804d3f70b4c96da0 \
  --header 'Authorization: Bearer your_api_key' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "updated-training-dataset"
}'
```

### Deleting a Disk

```bash
curl --request DELETE \
  --url https://api.primeintellect.ai/api/v1/disks/fdb5205fd9b14c9d804d3f70b4c96da0 \
  --header 'Authorization: Bearer your_api_key'
```

### Disk Status Values

| Status       | Description                                               |
| ------------ | --------------------------------------------------------- |
| PROVISIONING | Disk is being created                                     |
| PENDING      | Disk status is changing                                   |
| ACTIVE       | Disk is ready and can be attached to instances or deleted |
| STOPPED      | Disk is stopped                                           |
| ERROR        | An error occurred during disk operations                  |
| DELETING     | Disk is being deleted                                     |
| TERMINATED   | Disk has been deleted                                     |
| UNKNOWN      | Disk status is unknown                                    |

---

# Inference API

## Models

List and retrieve language models for inference.

**Base URL:** `https://api.pinference.ai/api/v1`

### Authentication

All requests require a Bearer token in the Authorization header:

```
Authorization: Bearer your_api_key
```

### Team Account Usage

When using a team account, include the `X-Prime-Team-ID` header:

```
X-Prime-Team-ID: your-team-id-here
```

### List Models

```bash
curl -X GET https://api.pinference.ai/api/v1/models \
  -H "Authorization: Bearer $API_KEY"
```

Response:

```json
{
  "object": "list",
  "data": [
    {
      "id": "meta-llama/llama-3.1-70b-instruct",
      "object": "model",
      "owned_by": "meta",
      "created": 1693721698
    },
    {
      "id": "anthropic/claude-3-5-sonnet-20241022",
      "object": "model",
      "owned_by": "anthropic",
      "created": 1693721698
    }
  ]
}
```

### Get Model Details

```bash
curl -X GET https://api.pinference.ai/api/v1/models/meta-llama/llama-3.1-70b-instruct \
  -H "Authorization: Bearer $API_KEY"
```

---

## Chat Completions

Generate text responses using language models.

### Create Chat Completion

```bash
curl -X POST https://api.pinference.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.1-70b-instruct",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ]
  }'
```

### Parameters

| Parameter   | Type         | Required | Description                    |
| ----------- | ------------ | -------- | ------------------------------ |
| model       | string       | Yes      | Model ID to use for completion |
| messages    | array        | Yes      | Conversation messages          |
| max_tokens  | integer      | No       | Maximum tokens to generate     |
| temperature | number       | No       | Sampling temperature (0-2)     |
| stream      | boolean      | No       | Enable streaming responses     |
| stop        | string/array | No       | Stop sequences                 |

### Response

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1693721698,
  "model": "meta-llama/llama-3.1-70b-instruct",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 8,
    "total_tokens": 20
  }
}
```

### Streaming

```python
stream = client.chat.completions.create(
    model="meta-llama/llama-3.1-70b-instruct",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

---

# Availability

## GET Get Legacy GPU Availability

```
GET /api/v1/availability
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/availability/?page=1&page_size=500' \
  --header 'Authorization: Bearer <token>'
```

### Query Parameters

| Parameter      | Type     | Default | Description                                      |
| -------------- | -------- | ------- | ------------------------------------------------ |
| page           | integer  | 1       | Page number (1-indexed)                          |
| page_size      | integer  | 500     | Number of results per page (1-500)               |
| regions        | enum[]   | null    | List of regions to filter                        |
| gpu_count      | integer  | null    | Desired number of GPUs                           |
| gpu_type       | enum     | null    | GPU model                                        |
| socket         | enum     | null    | Socket type (PCIe, SXM2, SXM3, SXM4, SXM5, SXM6) |
| security       | enum     | null    | Security type (secure_cloud, community_cloud)    |
| data_center_id | string   | null    | Filter by data center ID                         |
| cloud_id       | string   | null    | Filter by cloud ID                               |
| disks          | string[] | null    | List of disk IDs to filter instances by location |

### Available GPU Types

CPU_NODE, A10_24GB, A100_80GB, A100_40GB, A30_24GB, A40_48GB, B200_180GB, B300_262GB, RTX3070_8GB, RTX3080_10GB, RTX3080Ti_12GB, RTX3090_24GB, RTX3090Ti_24GB, RTX4070Ti_12GB, RTX4080_16GB, RTX4080Ti_16GB, RTX4090_24GB, RTX5090_32GB, H100_80GB, H200_96GB, GH200_96GB, H200_141GB, GH200_480GB, GH200_624GB, L4_24GB, L40_48GB, L40S_48GB, RTX4000_8GB, RTX5000_16GB, RTX6000_24GB, RTX8000_48GB, RTX2000Ada_16GB, RTX4000Ada_20GB, RTX5000Ada_32GB, RTX6000Ada_48GB, A2000_6GB, A4000_16GB, A4500_20GB, A5000_24GB, A6000_48GB, V100_16GB, V100_32GB, P100_16GB, T4_16GB, P4_8GB, P40_24GB, RTX_PRO_6000B_96GB

### Available Regions

africa, asia_south, asia_northeast, australia, canada, eu_east, eu_north, eu_west, middle_east, south_america, united_states

---

## GET Get Legacy Cluster Availability

```
GET /api/v1/availability/clusters
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/availability/clusters?page=1&page_size=500' \
  --header 'Authorization: Bearer <token>'
```

Same query parameters and response format as Get Legacy GPU Availability.

---

## GET Get Disks Availability

```
GET /api/v1/availability/disks
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/availability/disks?page=1&page_size=100' \
  --header 'Authorization: Bearer <token>'
```

### Response

```json
{
  "items": [
    {
      "provider": "runpod",
      "security": "secure_cloud",
      "cloudId": "<string>",
      "dataCenter": "<string>",
      "country": "<string>",
      "region": "africa",
      "spec": {},
      "stockStatus": "Available",
      "isMultinode": true
    }
  ],
  "totalCount": 123
}
```

---

## GET Get GPU Summary

Get GPU pricing summary data grouped by GPU type and instance count.

```
GET /api/v1/availability/gpu-summary
```

```bash
curl --request GET \
  --url https://api.primeintellect.ai/api/v1/availability/gpu-summary \
  --header 'Authorization: Bearer <token>'
```

---

## GET Get GPU Availability

```
GET /api/v1/availability/gpus
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/availability/gpus?page=1&page_size=100' \
  --header 'Authorization: Bearer <token>'
```

### Response

```json
{
  "items": [
    {
      "cloudId": "<string>",
      "gpuType": "CPU_NODE",
      "socket": "PCIe",
      "provider": "runpod",
      "gpuCount": 123,
      "gpuMemory": 123,
      "security": "secure_cloud",
      "prices": {
        "currency": "USD",
        "onDemand": 1.15,
        "communityPrice": null,
        "isVariable": false
      },
      "images": ["ubuntu_22_cuda_12"],
      "region": "africa",
      "dataCenter": "<string>",
      "country": "<string>",
      "stockStatus": "Available"
    }
  ],
  "totalCount": 123
}
```

---

## GET Get Multinode Availability

```
GET /api/v1/availability/multi-node
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/availability/multi-node?page=1&page_size=100' \
  --header 'Authorization: Bearer <token>'
```

Same response format as Get GPU Availability.

---

## GET Get Multinode Summary

Get multi-node (cluster) pricing summary data grouped by GPU type and instance count.

```
GET /api/v1/availability/multi-node-summary
```

```bash
curl --request GET \
  --url https://api.primeintellect.ai/api/v1/availability/multi-node-summary \
  --header 'Authorization: Bearer <token>'
```

---

# Disks

## GET List Disks

```
GET /api/v1/disks
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/disks/?limit=100' \
  --header 'Authorization: Bearer <token>'
```

### Query Parameters

| Parameter | Type    | Default | Description                       |
| --------- | ------- | ------- | --------------------------------- |
| offset    | integer | 0       | Number of items to skip           |
| limit     | integer | 100     | Maximum number of items to return |

### Response

```json
{
  "data": [
    {
      "name": "<string>",
      "providerType": "runpod",
      "userId": "<string>",
      "id": "<string>",
      "createdAt": "2023-11-07T05:31:56Z",
      "updatedAt": "2023-11-07T05:31:56Z",
      "terminatedAt": "2023-11-07T05:31:56Z",
      "status": "PROVISIONING",
      "size": 0,
      "info": {},
      "priceHr": 123,
      "stoppedPriceHr": 123,
      "provisioningPriceHr": 0,
      "teamId": "<string>",
      "walletId": "<string>",
      "pods": [],
      "clusters": []
    }
  ],
  "total_count": 0,
  "offset": 0,
  "limit": 100
}
```

---

## POST Create Disk

```
POST /api/v1/disks
```

```bash
curl --request POST \
  --url https://api.primeintellect.ai/api/v1/disks/ \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "disk": {
    "size": 123,
    "name": "<string>",
    "country": "<string>",
    "cloudId": "<string>",
    "dataCenterId": "<string>"
  },
  "provider": {
    "type": "runpod"
  },
  "team": {
    "teamId": "<string>"
  }
}'
```

### Available Provider Types

runpod, fluidstack, lambdalabs, hyperstack, oblivus, cudocompute, scaleway, tensordock, datacrunch, latitude, crusoecloud, massedcompute, akash, primeintellect, primecompute, dc_impala, dc_kudu, dc_roan, nebius, dc_eland, dc_wildebeest, vultr, dc_gnu, denvr

---

## GET Get Disk

```
GET /api/v1/disks/{disk_id}
```

```bash
curl --request GET \
  --url https://api.primeintellect.ai/api/v1/disks/{disk_id} \
  --header 'Authorization: Bearer <token>'
```

---

## DELETE Delete Disk

```
DELETE /api/v1/disks/{disk_id}
```

```bash
curl --request DELETE \
  --url https://api.primeintellect.ai/api/v1/disks/{disk_id} \
  --header 'Authorization: Bearer <token>'
```

---

## PATCH Update Disk

```
PATCH /api/v1/disks/{disk_id}
```

```bash
curl --request PATCH \
  --url https://api.primeintellect.ai/api/v1/disks/{disk_id} \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "name": "<string>"
}'
```

---

# Evals

## GET List Evaluations

Get a list of evaluations owned by the authenticated user or their teams.

```
GET /api/v1/evaluations
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/evaluations/?limit=50' \
  --header 'Authorization: Bearer <token>'
```

### Query Parameters

| Parameter        | Type    | Default | Description                     |
| ---------------- | ------- | ------- | ------------------------------- |
| team_id          | string  | null    | Filter by specific team ID      |
| environment_id   | string  | null    | Filter by environment ID        |
| environment_name | string  | null    | Filter by environment name      |
| suite_id         | string  | null    | Filter by suite ID              |
| skip             | integer | 0       | Number of items to skip         |
| limit            | integer | 50      | Maximum number of items (1-100) |

### Response

```json
{
  "evaluations": [
    {
      "evaluation_id": "<string>",
      "name": "<string>",
      "status": "PENDING",
      "eval_type": "suite",
      "total_samples": 123,
      "created_at": "2023-11-07T05:31:56Z",
      "updated_at": "2023-11-07T05:31:56Z",
      "user_id": "<string>",
      "team_id": "<string>",
      "environment_ids": ["<string>"],
      "environment_names": ["<string>"],
      "avg_score": 123,
      "min_score": 123,
      "max_score": 123
    }
  ],
  "total": 123,
  "skip": 123,
  "limit": 123
}
```

---

## POST Create Evaluation

```
POST /api/v1/evaluations
```

---

## GET Get Evaluation

```
GET /api/v1/evaluations/{evaluation_id}
```

---

## PUT Update Evaluation

```
PUT /api/v1/evaluations/{evaluation_id}
```

---

## DELETE Delete Evaluation

```
DELETE /api/v1/evaluations/{evaluation_id}
```

---

## POST Finalize Evaluation

```
POST /api/v1/evaluations/{evaluation_id}/finalize
```

---

## GET Get Samples

```
GET /api/v1/evaluations/{evaluation_id}/samples
```

---

## POST Push Samples

```
POST /api/v1/evaluations/{evaluation_id}/samples
```

---

# Images

## GET List User Images

```
GET /api/v1/images
```

```bash
curl --request GET \
  --url https://api.primeintellect.ai/api/v1/images/ \
  --header 'Authorization: Bearer <token>'
```

---

## POST Initiate Image Build

```
POST /api/v1/images/build/initiate
```

---

## GET Get Build Status

```
GET /api/v1/images/build/{build_id}/status
```

---

## POST Start Image Build

```
POST /api/v1/images/build/{build_id}/start
```

---

## GET List Image Builds

```
GET /api/v1/images/builds
```

---

## DELETE Delete User Image

```
DELETE /api/v1/images/{image_id}
```

---

# Pods

## GET Get Pods

```
GET /api/v1/pods
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/pods/?limit=100' \
  --header 'Authorization: Bearer <token>'
```

### Response

```json
{
  "data": [
    {
      "userId": "<string>",
      "name": "<string>",
      "providerType": "runpod",
      "gpuName": "CPU_NODE",
      "gpuCount": 123,
      "socket": "PCIe",
      "priceHr": 123,
      "id": "<string>",
      "teamId": "<string>",
      "walletId": "<string>",
      "type": "HOSTED",
      "status": "PROVISIONING",
      "installationStatus": "PENDING",
      "installationFailure": "<string>",
      "installationProgress": 123,
      "createdAt": "2023-11-07T05:31:56Z",
      "updatedAt": "2023-11-07T05:31:56Z",
      "terminatedAt": "2023-11-07T05:31:56Z",
      "stoppedPriceHr": 0.005,
      "provisioningPriceHr": 0,
      "environmentType": "ubuntu_22_cuda_12",
      "customTemplateId": "<string>",
      "clusterId": "<string>",
      "primePortMapping": [],
      "sshConnection": "<string>",
      "ip": "<string>",
      "resources": {
        "memory": "128",
        "disk": "1000",
        "vcpus": "32",
        "shared_disk": "1000"
      },
      "attachedResources": [],
      "isSpot": true,
      "autoRestart": true
    }
  ],
  "total_count": 0,
  "offset": 0,
  "limit": 100
}
```

---

## POST Create Pod

```
POST /api/v1/pods
```

```bash
curl --request POST \
  --url https://api.primeintellect.ai/api/v1/pods/ \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "pod": {
    "cloudId": "<string>",
    "gpuType": "CPU_NODE",
    "socket": "PCIe",
    "gpuCount": 123,
    "name": "<string>",
    "diskSize": 1,
    "vcpus": 1,
    "memory": 1,
    "maxPrice": 123,
    "image": "ubuntu_22_cuda_12",
    "customTemplateId": "<string>",
    "dataCenterId": "<string>",
    "country": "<string>",
    "security": "secure_cloud",
    "envVars": [
      {
        "key": "<string>",
        "value": "<string>"
      }
    ],
    "jupyterPassword": "<string>",
    "sshKeyId": "<string>",
    "autoRestart": false,
    "prepaidForHr": 1
  },
  "provider": {
    "type": "runpod"
  },
  "disks": ["<string>"],
  "team": {
    "teamId": "<string>"
  }
}'
```

### Available Image Types

ubuntu_22_cuda_12, cuda_12_1_pytorch_2_2, cuda_11_8_pytorch_2_1, cuda_12_1_pytorch_2_3, cuda_12_1_pytorch_2_4, cuda_12_4_pytorch_2_4, cuda_12_4_pytorch_2_5, cuda_12_4_pytorch_2_6, cuda_12_6_pytorch_2_7, stable_diffusion, axolotl, bittensor, hivemind, petals_llama, vllm_llama_8b, vllm_llama_70b, vllm_llama_405b, custom_template, flux, prime_rl

### Pod Status Values

| Status       | Description                   |
| ------------ | ----------------------------- |
| PROVISIONING | Pod is being created          |
| PENDING      | Pod status is changing        |
| ACTIVE       | Pod is running and accessible |
| STOPPED      | Pod is stopped                |
| ERROR        | An error occurred             |
| DELETING     | Pod is being deleted          |
| UNKNOWN      | Status is unknown             |
| TERMINATED   | Pod has been terminated       |

---

## GET Get Pods History

```
GET /api/v1/pods/history
```

---

## GET Get Pods Status

```
GET /api/v1/pods/status
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/pods/status/?pod_ids=<pod_id>' \
  --header 'Authorization: Bearer <token>'
```

---

## GET Get Pod

```
GET /api/v1/pods/{pod_id}
```

---

## DELETE Delete Pod

```
DELETE /api/v1/pods/{pod_id}
```

---

## GET Get Pod Logs Api

```
GET /api/v1/pods/{pod_id}/logs
```

---

# Sandbox

## GET List Sandboxes

List sandboxes for user or team.

```
GET /api/v1/sandbox
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/sandbox?page=1&per_page=50' \
  --header 'Authorization: Bearer <token>'
```

**Rate Limit:** 1000 requests per 60 seconds per IP and token.

### Query Parameters

| Parameter | Type     | Default | Description                                                                   |
| --------- | -------- | ------- | ----------------------------------------------------------------------------- |
| team_id   | string   | null    | Filter by team ID                                                             |
| status    | enum     | null    | Filter by status (PENDING, PROVISIONING, RUNNING, STOPPED, ERROR, TERMINATED) |
| is_active | boolean  | null    | Filter to exclude terminated sandboxes when True                              |
| labels    | string[] | null    | Filter by labels (sandboxes must have ALL specified labels)                   |
| page      | integer  | 1       | Page number                                                                   |
| per_page  | integer  | 50      | Items per page (1-1000)                                                       |

### Response

```json
{
  "sandboxes": [
    {
      "id": "<string>",
      "name": "<string>",
      "dockerImage": "<string>",
      "startCommand": "<string>",
      "cpuCores": 123,
      "memoryGB": 123,
      "diskSizeGB": 123,
      "diskMountPath": "<string>",
      "gpuCount": 123,
      "networkAccess": true,
      "status": "PENDING",
      "timeoutMinutes": 123,
      "environmentVars": {},
      "advancedConfigs": {},
      "createdAt": "2023-11-07T05:31:56Z",
      "updatedAt": "2023-11-07T05:31:56Z",
      "startedAt": "2023-11-07T05:31:56Z",
      "terminatedAt": "2023-11-07T05:31:56Z",
      "exitCode": 123,
      "userId": "<string>",
      "teamId": "<string>",
      "kubernetesJobId": "<string>",
      "labels": ["<string>"],
      "registryCredentialsId": "<string>"
    }
  ],
  "total": 123,
  "page": 123,
  "per_page": 123,
  "has_next": true
}
```

---

## POST Create Sandbox Endpoint

```
POST /api/v1/sandbox
```

---

## DELETE Bulk Delete Sandboxes Endpoint

```
DELETE /api/v1/sandbox/bulk
```

---

## GET List All Exposed Ports Endpoint

```
GET /api/v1/sandbox/ports
```

---

## GET Get Sandbox Endpoint

```
GET /api/v1/sandbox/{sandbox_id}
```

---

## DELETE Delete Sandbox Endpoint

```
DELETE /api/v1/sandbox/{sandbox_id}
```

---

## POST Get Sandbox Auth Token

```
POST /api/v1/sandbox/{sandbox_id}/auth-token
```

---

## GET List Exposed Ports Endpoint

```
GET /api/v1/sandbox/{sandbox_id}/ports
```

---

## POST Expose Port Endpoint

```
POST /api/v1/sandbox/{sandbox_id}/ports
```

---

## DELETE Unexpose Port Endpoint

```
DELETE /api/v1/sandbox/{sandbox_id}/ports/{port}
```

---

## GET Get Sandbox Logs Endpoint

```
GET /api/v1/sandbox/{sandbox_id}/logs
```

---

# SSH Keys

## GET Get SSH Keys

```
GET /api/v1/ssh_keys
```

```bash
curl --request GET \
  --url 'https://api.primeintellect.ai/api/v1/ssh_keys/?limit=100' \
  --header 'Authorization: Bearer <token>'
```

### Response

```json
{
  "data": [
    {
      "id": "<string>",
      "userId": "<string>",
      "name": "<string>",
      "publicKey": "<string>",
      "isPrimary": true,
      "isUserKey": true,
      "createdAt": "2023-11-07T05:31:56Z",
      "updatedAt": "2023-11-07T05:31:56Z"
    }
  ],
  "total_count": 0,
  "offset": 0,
  "limit": 100
}
```

---

## POST Upload SSH Key

```
POST /api/v1/ssh_keys
```

---

## DELETE Delete SSH Key

```
DELETE /api/v1/ssh_keys/{key_id}
```

---

## PATCH Set Primary Key

```
PATCH /api/v1/ssh_keys/{key_id}/primary
```

---

# Template

## POST Check Docker Image

```
POST /api/v1/templates/check-image
```

---

## GET List Registry Credentials

```
GET /api/v1/templates/registry-credentials
```

---

# User

## PATCH Set Username Slug

```
PATCH /api/v1/user/slug
```

---

## GET List My Teams

```
GET /api/v1/user/teams
```

---

## GET Get Whoami

```
GET /api/v1/user/whoami
```

```bash
curl --request GET \
  --url https://api.primeintellect.ai/api/v1/user/whoami \
  --header 'Authorization: Bearer <token>'
```

### Response

```json
{
  "data": {
    "name": "<string>",
    "email": "<string>",
    "id": "<string>",
    "role": "USER",
    "createdAt": "2023-11-07T05:31:56Z",
    "slug": "<string>",
    "image": "<string>",
    "emailVerified": true,
    "hasBetaAccess": false,
    "isBanned": false,
    "skipPrepay": false,
    "blacklist": [],
    "scope": {}
  },
  "status": "<string>"
}
```

---

# Error Handling

## Common Error Responses

### Model Not Found (404)

```json
{
  "error": {
    "message": "The model 'invalid-model' does not exist",
    "type": "invalid_request_error",
    "code": "model_not_found"
  }
}
```

### Authentication Error (401)

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

### Rate Limit (429)

```json
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}
```

### Invalid Model (400)

```json
{
  "error": {
    "message": "Invalid model specified",
    "type": "invalid_request_error",
    "code": "invalid_model"
  }
}
```

### Context Length Exceeded (400)

```json
{
  "error": {
    "message": "Context length exceeded",
    "type": "invalid_request_error",
    "code": "context_length_exceeded"
  }
}
```

### Validation Error (422)

Returned when request parameters fail validation.

---

# Support & Links

- **Platform:** [https://app.primeintellect.ai](https://app.primeintellect.ai)
- **Support:** contact@primeintellect.ai
- **Discord:** [https://discord.gg/ZTFydGWPKj](https://discord.gg/ZTFydGWPKj)
- **Twitter:** [https://twitter.com/PrimeIntellect](https://twitter.com/PrimeIntellect)
- **GitHub:** [https://github.com/PrimeIntellect-ai](https://github.com/PrimeIntellect-ai)
- **LinkedIn:** [https://www.linkedin.com/company/primeintellect-ai](https://www.linkedin.com/company/primeintellect-ai)
- **Blog:** [https://www.primeintellect.ai/blog](https://www.primeintellect.ai/blog)

---

_Documentation scraped from [https://docs.primeintellect.ai/api-reference/introduction](https://docs.primeintellect.ai/api-reference/introduction)_
