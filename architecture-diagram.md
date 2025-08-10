# Jenkins MCP Server - Architecture Diagram

## System Overview

```mermaid
graph TB
    subgraph "Slack Environment"
        U[User] --> SA[Slack AI Agent]
    end
    
    subgraph "Jenkins MCP Server (Node.js/TypeScript)"
        SA -->|MCP Tools via stdio| MCP[MCP Server]
        
        subgraph "MCP Tools"
            MCP --> TJ[trigger_jenkins_job]
            MCP --> GS[get_job_status] 
            MCP --> LJ[list_jenkins_jobs]
        end
        
        subgraph "Services"
            TJ --> JC[Jenkins Client]
            GS --> JC
            LJ --> JC
            JC --> JT[Job Tracker]
            WH[Webhook Handler] --> JT
        end
        
        subgraph "Data Layer"
            JT --> R[(Redis)]
        end
        
        subgraph "HTTP Server"
            WH --> EX[Express Server]
            EX --> WE["/webhook/jenkins"]
            EX --> HE["/health"]
        end
    end
    
    subgraph "Jenkins CI/CD"
        JC -->|API Calls| J[Jenkins Server]
        J -->|Webhook Notifications| WE
    end
    
    
    %% Data Flow
    SA -.->|Status Updates| SA
    WE -.->|HTTP Webhook| SA
    
    %% Styling
    classDef typescript fill:#3178c6,stroke:#ffffff,color:#ffffff
    classDef external fill:#ff6b6b,stroke:#ffffff,color:#ffffff
    classDef data fill:#4ecdc4,stroke:#ffffff,color:#ffffff
    
    class MCP,TJ,GS,LJ,JC,JT,WH,EX typescript
    class SA,J,U external
    class R data
```

## Component Architecture

### 1. MCP Server Layer (TypeScript)
```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Server Service                       │
├─────────────────────────────────────────────────────────────┤
│  • Server initialization and tool registration             │
│  • Request routing to appropriate tools                     │
│  • Error handling and logging                              │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ trigger_jenkins │ │  get_job_status │ │ list_jenkins    │
│     _job        │ │                 │ │    _jobs        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 2. Service Layer (TypeScript)
```
┌─────────────────────────────────────────────────────────────┐
│                   Jenkins Client Service                    │
├─────────────────────────────────────────────────────────────┤
│  • API authentication with Jenkins                         │
│  • Job triggering with parameters                          │
│  • Status queries and job information retrieval            │
│  • Error handling for Jenkins API calls                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Job Tracker Service                       │
├─────────────────────────────────────────────────────────────┤
│  • Store callback information in Redis                     │
│  • Track job execution state                               │
│  • Clean up completed job data                             │
│  • Manage job-to-Slack thread mapping                      │
└─────────────────────────────────────────────────────────────┘
```

### 3. Webhook Layer (TypeScript)
```
┌─────────────────────────────────────────────────────────────┐
│                 Webhook Handler Service                     │
├─────────────────────────────────────────────────────────────┤
│  • Receive Jenkins build completion notifications          │
│  • Parse and validate webhook payloads                     │
│  • Send status updates back to Slack AI Agent              │
│  • Handle webhook authentication                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express HTTP Server                      │
├─────────────────────────────────────────────────────────────┤
│  POST /webhook/jenkins  - Jenkins notification endpoint    │
│  GET  /health          - Health check endpoint             │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant SA as Slack AI Agent
    participant MCP as MCP Server
    participant JC as Jenkins Client
    participant J as Jenkins
    participant WH as Webhook Handler
    participant R as Redis

    U->>SA: "@bot deploy to staging"
    SA->>MCP: trigger_jenkins_job(jobName, params, callbackInfo)
    MCP->>JC: triggerJob(jobName, parameters)
    JC->>J: POST /job/{name}/buildWithParameters
    J-->>JC: {queueId, buildNumber}
    JC->>R: store(callbackInfo, jobInfo)
    JC-->>MCP: {buildNumber, queueId, status}
    MCP-->>SA: Job triggered successfully
    SA->>U: "✅ Jenkins job started - Build #123"
    
    Note over J: Job executes...
    
    J->>WH: POST /webhook/jenkins (build complete)
    WH->>R: get(callbackInfo)
    WH->>SA: POST /jenkins/status (status update)
    SA->>U: "🎉 Deploy completed successfully!"
```

## Technology Stack Breakdown

### Implementation Stack
- **Runtime**: Node.js 20+
- **Framework**: Express.js for webhook server
- **MCP SDK**: @modelcontextprotocol/sdk
- **Jenkins Integration**: jenkins npm package + axios
- **Data Storage**: Redis for job tracking
- **Testing**: Jest + TypeScript
- **Logging**: Winston


## Configuration Management

```
Environment Variables
├── Jenkins Configuration
│   ├── JENKINS_URL
│   ├── JENKINS_USERNAME
│   ├── JENKINS_PASSWORD
│   └── JENKINS_API_TOKEN
├── MCP Server Configuration
│   ├── MCP_SERVER_NAME
│   └── MCP_SERVER_VERSION
├── Webhook Configuration
│   ├── WEBHOOK_PORT
│   └── WEBHOOK_SECRET
├── Redis Configuration
│   └── REDIS_URL
└── Slack Integration
    └── SLACK_WEBHOOK_URL
```

## Security Architecture

```mermaid
graph LR
    subgraph "Authentication Layers"
        A1[Jenkins API Token] --> JC[Jenkins Client]
        A2[Webhook Secret] --> WH[Webhook Handler]
        A3[MCP stdio Transport] --> MCP[MCP Server]
    end
    
    subgraph "Validation Layers"
        V1[Parameter Validation] --> TOOLS[MCP Tools]
        V2[Webhook Signature] --> WH
        V3[Input Sanitization] --> JC
    end
    
    subgraph "Network Security"
        N1[Internal HTTP Server] --> EX[Express Server]
        N2[Redis Connection] --> R[(Redis)]
    end
```

## Deployment Architecture

```
Docker Container
├── Node.js Runtime
├── Application Code (TypeScript compiled to JavaScript)
├── Dependencies (node_modules)
├── Configuration Files
└── Health Check Endpoint

External Dependencies
├── Jenkins Server (HTTP API)
├── Redis Server (Data Storage)
└── Slack AI Agent (Webhook Target)
```