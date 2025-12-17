import { GoogleAuth } from 'google-auth-library';
import * as grpc from '@grpc/grpc-js';

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
}

export class GoogleAuthManager {
  private auth: GoogleAuth;
  private config: AuthConfig;
  private scopes: string[];

  constructor(config: AuthConfig) {
    this.config = config;
    this.scopes = config.scopes || [
      'https://www.googleapis.com/auth/tasks',
    ];

    this.auth = new GoogleAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      scopes: this.scopes,
    });
  }

  async getAccessToken(): Promise<string> {
    try {
      const client = await this.auth.getClient();
      const tokenResponse = await client.getAccessToken();
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
        async (_params: grpc.CallMetadataOptions, callback: grpc.MetadataGeneratorCallback) => {
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

  getAuthClient(): GoogleAuth {
    return this.auth;
  }
}

