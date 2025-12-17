import { OAuth2Client } from 'google-auth-library';
import * as grpc from '@grpc/grpc-js';
import { GoogleAuthManager, AuthConfig } from './auth';

jest.mock('google-auth-library');
jest.mock('@grpc/grpc-js', () => {
  const mockMetadataInstance = {
    add: jest.fn(),
    get: jest.fn().mockReturnValue([]),
  };
  const mockMetadata = jest.fn().mockImplementation(() => mockMetadataInstance);
  return {
    ...jest.requireActual('@grpc/grpc-js'),
    Metadata: mockMetadata,
    credentials: {
      createSsl: jest.fn().mockReturnValue({}),
      createFromMetadataGenerator: jest.fn().mockReturnValue({}),
      combineChannelCredentials: jest.fn().mockReturnValue({}),
    },
  };
});

describe('GoogleAuthManager', () => {
  let mockOAuth2Client: {
    getAccessToken: jest.Mock<Promise<{ token: string | null | undefined }>>;
  };
  let authConfig: AuthConfig;

  beforeEach(() => {
    authConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/oauth2callback',
    };

    mockOAuth2Client = {
      getAccessToken: jest.fn(),
    };

    (OAuth2Client as jest.MockedClass<typeof OAuth2Client>).mockImplementation(() => {
      return mockOAuth2Client as any;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config and default scopes', () => {
      const manager = new GoogleAuthManager(authConfig);

      expect(OAuth2Client).toHaveBeenCalledWith({
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret,
        redirectUri: authConfig.redirectUri,
      });
      expect(manager.getAuthClient()).toBe(mockOAuth2Client);
    });

    it('should initialize with custom scopes when provided', () => {
      const customScopes = [
        'https://www.googleapis.com/auth/tasks',
        'https://www.googleapis.com/auth/tasks.readonly',
      ];
      const configWithScopes = { ...authConfig, scopes: customScopes };

      new GoogleAuthManager(configWithScopes);

      expect(OAuth2Client).toHaveBeenCalledWith({
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret,
        redirectUri: authConfig.redirectUri,
      });
    });
  });

  describe('getAccessToken', () => {
    it('should return access token successfully', async () => {
      const token = 'test-access-token';
      mockOAuth2Client.getAccessToken.mockResolvedValue({ token });

      const manager = new GoogleAuthManager(authConfig);
      const result = await manager.getAccessToken();

      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalled();
      expect(result).toBe(token);
    });

    it('should throw error when token is missing', async () => {
      mockOAuth2Client.getAccessToken.mockResolvedValue({ token: null });

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getAccessToken()).rejects.toThrow(
        'Failed to obtain access token',
      );
    });

    it('should throw error when token is undefined', async () => {
      mockOAuth2Client.getAccessToken.mockResolvedValue({ token: undefined });

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getAccessToken()).rejects.toThrow(
        'Failed to obtain access token',
      );
    });

    it('should handle authentication failures', async () => {
      const error = new Error('Authentication failed');
      mockOAuth2Client.getAccessToken.mockRejectedValue(error);

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getAccessToken()).rejects.toThrow(
        'Authentication failed: Error: Authentication failed',
      );
    });

    it('should handle getAccessToken failures', async () => {
      const error = new Error('Token request failed');
      mockOAuth2Client.getAccessToken.mockRejectedValue(error);

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getAccessToken()).rejects.toThrow(
        'Authentication failed: Error: Token request failed',
      );
    });
  });

  describe('getGrpcCredentials', () => {
    beforeEach(() => {
      mockOAuth2Client.getAccessToken.mockResolvedValue({ token: 'test-token' });
    });

    it('should create gRPC credentials successfully', async () => {
      const manager = new GoogleAuthManager(authConfig);
      const credentials = await manager.getGrpcCredentials();

      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalled();
      expect(credentials).toBeDefined();
      expect(grpc.credentials.createSsl).toHaveBeenCalled();
      expect(grpc.credentials.createFromMetadataGenerator).toHaveBeenCalled();
      expect(grpc.credentials.combineChannelCredentials).toHaveBeenCalled();
    });

    it('should include Bearer token in metadata', async () => {
      const token = 'test-bearer-token';
      mockOAuth2Client.getAccessToken.mockResolvedValue({ token });

      const manager = new GoogleAuthManager(authConfig);
      await manager.getGrpcCredentials();

      expect(grpc.credentials.createFromMetadataGenerator).toHaveBeenCalled();
      const metadataGenerator = (grpc.credentials.createFromMetadataGenerator as jest.Mock).mock.calls[0][0];
      expect(typeof metadataGenerator).toBe('function');
    });

    it('should handle errors when getting access token', async () => {
      const error = new Error('Token error');
      mockOAuth2Client.getAccessToken.mockRejectedValue(error);

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getGrpcCredentials()).rejects.toThrow(
        'Failed to create gRPC credentials: Error: Authentication failed: Error: Token error',
      );
    });
  });

  describe('getMetadata', () => {
    it('should create metadata with Bearer token successfully', async () => {
      const token = 'test-metadata-token';
      mockOAuth2Client.getAccessToken.mockResolvedValue({ token });

      const manager = new GoogleAuthManager(authConfig);
      const metadata = await manager.getMetadata();

      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalled();
      expect(metadata).toBeDefined();
      expect(metadata.add).toHaveBeenCalledWith('authorization', `Bearer ${token}`);
    });

    it('should handle errors when getting access token', async () => {
      const error = new Error('Token error');
      mockOAuth2Client.getAccessToken.mockRejectedValue(error);

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getMetadata()).rejects.toThrow(
        'Failed to create metadata: Error: Authentication failed: Error: Token error',
      );
    });
  });

  describe('getAuthClient', () => {
    it('should return the OAuth2Client instance', () => {
      const manager = new GoogleAuthManager(authConfig);
      const client = manager.getAuthClient();

      expect(client).toBe(mockOAuth2Client);
    });
  });
});

