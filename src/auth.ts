import { OAuth2Client } from 'google-auth-library';
import * as grpc from '@grpc/grpc-js';
import type { CallMetadataOptions } from '@grpc/grpc-js/build/src/call-credentials';

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export class GoogleAuthManager {
  private auth: OAuth2Client;
  private config: AuthConfig;
  private scopes: string[];

  constructor(config: AuthConfig) {
    this.config = config;
    this.scopes = config.scopes || [
      'https://www.googleapis.com/auth/tasks',
    ];

    this.auth = new OAuth2Client({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
  }

  async getAccessToken(): Promise<string> {
    try {
      const tokenResponse = await this.auth.getAccessToken();
      if (!tokenResponse.token) {
        throw new Error('Failed to obtain access token');
      }
      return tokenResponse.token;
    } catch (error) {
      throw new Error(`Authentication failed: ${error}`);
    }
  }

  async getGrpcCredentials(): Promise<grpc.ChannelCredentials> {
    try {
      const accessToken = await this.getAccessToken();

      // Create call credentials from the access token
      const callCredentials = grpc.credentials.createFromMetadataGenerator(
        (options: CallMetadataOptions, callback: (err: Error | null, metadata?: grpc.Metadata) => void) => {
          const metadata = new grpc.Metadata();
          metadata.add('authorization', `Bearer ${accessToken}`);
          callback(null, metadata);
        },
      );

      // Combine SSL credentials with call credentials
      const sslCredentials = grpc.credentials.createSsl();
      return grpc.credentials.combineChannelCredentials(
        sslCredentials,
        callCredentials,
      );
    } catch (error) {
      throw new Error(`Failed to create gRPC credentials: ${error}`);
    }
  }

  async getMetadata(): Promise<grpc.Metadata> {
    try {
      const accessToken = await this.getAccessToken();
      const metadata = new grpc.Metadata();
      metadata.add('authorization', `Bearer ${accessToken}`);
      return metadata;
    } catch (error) {
      throw new Error(`Failed to create metadata: ${error}`);
    }
  }

  getAuthClient(): OAuth2Client {
    return this.auth;
  }
}

