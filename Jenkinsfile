pipeline {
    agent any
    
    environment {
        DOCKER_IMAGE = 'toko-kopi-maru'
        DOCKER_REGISTRY = 'your-registry.com' // Update this
        NODE_ENV = getEnvironment()
        DEPLOY_HOST = getDeployHost()
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo "Checking out ${env.BRANCH_NAME} branch"
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                script {
                    echo 'Installing dependencies...'
                    sh 'npm ci'
                }
            }
        }
        
        stage('Code Quality') {
            parallel {
                stage('Lint') {
                    steps {
                        echo 'Running ESLint...'
                        sh 'npm run lint'
                    }
                }
                
                stage('Type Check') {
                    steps {
                        echo 'Running TypeScript type check...'
                        sh 'npx tsc --noEmit'
                    }
                }
                
                stage('Security Audit') {
                    steps {
                        echo 'Running security audit...'
                        sh 'npm audit --audit-level=moderate || true'
                    }
                }
            }
        }
        
        stage('Build') {
            steps {
                script {
                    echo "Building application for ${env.NODE_ENV}..."
                    sh """
                        npm run build
                    """
                }
            }
        }
        
        stage('Docker Build') {
            steps {
                script {
                    def imageTag = "${env.DOCKER_IMAGE}:${env.BRANCH_NAME}-${env.BUILD_NUMBER}"
                    def latestTag = "${env.DOCKER_IMAGE}:${env.BRANCH_NAME}-latest"
                    
                    echo "Building Docker image: ${imageTag}"
                    sh """
                        docker build -t ${imageTag} -t ${latestTag} .
                    """
                    
                    // Prune old images
                    echo 'Pruning unused Docker images...'
                    sh """
                        docker image prune -f --filter "until=24h"
                        docker system prune -f --volumes
                    """
                }
            }
        }
        
        stage('Deploy') {
            when {
                anyOf {
                    branch 'development'
                    branch 'staging'
                    branch 'main'
                }
            }
            steps {
                script {
                    def imageTag = "${env.DOCKER_IMAGE}:${env.BRANCH_NAME}-${env.BUILD_NUMBER}"
                    
                    echo "Deploying to ${env.NODE_ENV} environment..."
                    
                    // Stop and remove old containers
                    sh """
                        docker-compose -f docker-compose.${env.BRANCH_NAME}.yml down || true
                    """
                    
                    // Deploy new version
                    sh """
                        export IMAGE_TAG=${imageTag}
                        docker-compose -f docker-compose.${env.BRANCH_NAME}.yml up -d
                    """
                    
                    // Health check
                    sleep(time: 10, unit: 'SECONDS')
                    sh """
                        curl -f http://${env.DEPLOY_HOST}/api/health || exit 1
                    """
                }
            }
        }
        
        stage('Post Deploy Cleanup') {
            when {
                anyOf {
                    branch 'development'
                    branch 'staging'
                    branch 'main'
                }
            }
            steps {
                script {
                    echo 'Cleaning up dangling images...'
                    sh """
                        docker image prune -f
                        docker container prune -f
                    """
                }
            }
        }
    }
    
    post {
        success {
            echo "✅ Pipeline completed successfully for ${env.BRANCH_NAME}"
            // Add notification here (Slack, Email, etc.)
        }
        failure {
            echo "❌ Pipeline failed for ${env.BRANCH_NAME}"
            // Add notification here (Slack, Email, etc.)
        }
        cleanup {
            echo 'Cleaning up workspace...'
            cleanWs()
        }
    }
}

// Helper function to get environment based on branch
def getEnvironment() {
    switch(env.BRANCH_NAME) {
        case 'main':
            return 'main'
        case 'staging':
            return 'staging'
        case 'development':
            return 'development'
        default:
            return 'development'
    }
}

// Helper function to get deploy host based on branch
def getDeployHost() {
    switch(env.BRANCH_NAME) {
        case 'main':
            return 'prod.toko-kopi-maru.com'
        case 'staging':
            return 'staging.toko-kopi-maru.com'
        case 'development':
            return 'dev.toko-kopi-maru.com'
        default:
            return 'localhost:3000'
    }
}
