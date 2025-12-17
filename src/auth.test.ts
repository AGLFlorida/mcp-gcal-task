import { GoogleAuth } from 'google-auth-library';
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
  let mockGoogleAuth: jest.Mocked<GoogleAuth>;
  let mockClient: any;
  let authConfig: AuthConfig;

  beforeEach(() => {
    authConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/oauth2callback',
    };

    mockClient = {
      getAccessToken: jest.fn(),
    };

    mockGoogleAuth = {
      getClient: jest.fn().mockResolvedValue(mockClient),
    } as any;

    (GoogleAuth as jest.MockedClass<typeof GoogleAuth>).mockImplementation(() => {
      return mockGoogleAuth;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config and default scopes', () => {
      const manager = new GoogleAuthManager(authConfig);

      expect(GoogleAuth).toHaveBeenCalledWith({
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret,
        redirectUri: authConfig.redirectUri,
        scopes: ['https://www.googleapis.com/auth/tasks'],
      });
      expect(manager.getAuthClient()).toBe(mockGoogleAuth);
    });

    it('should initialize with custom scopes when provided', () => {
      const customScopes = [
        'https://www.googleapis.com/auth/tasks',
        'https://www.googleapis.com/auth/tasks.readonly',
      ];
      const configWithScopes = { ...authConfig, scopes: customScopes };

      new GoogleAuthManager(configWithScopes);

      expect(GoogleAuth).toHaveBeenCalledWith({
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret,
        redirectUri: authConfig.redirectUri,
        scopes: customScopes,
      });
    });
  });

  describe('getAccessToken', () => {
    it('should return access token successfully', async () => {
      const token = 'test-access-token';
      mockClient.getAccessToken.mockResolvedValue({ token });

      const manager = new GoogleAuthManager(authConfig);
      const result = await manager.getAccessToken();

      expect(mockGoogleAuth.getClient).toHaveBeenCalled();
      expect(mockClient.getAccessToken).toHaveBeenCalled();
      expect(result).toBe(token);
    });

    it('should throw error when token is missing', async () => {
      mockClient.getAccessToken.mockResolvedValue({ token: null });

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getAccessToken()).rejects.toThrow(
        'Failed to obtain access token',
      );
    });

    it('should throw error when token is undefined', async () => {
      mockClient.getAccessToken.mockResolvedValue({ token: undefined });

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getAccessToken()).rejects.toThrow(
        'Failed to obtain access token',
      );
    });

    it('should handle authentication failures', async () => {
      const error = new Error('Authentication failed');
      mockGoogleAuth.getClient.mockRejectedValue(error);

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getAccessToken()).rejects.toThrow(
        'Authentication failed: Error: Authentication failed',
      );
    });

    it('should handle getAccessToken failures', async () => {
      const error = new Error('Token request failed');
      mockClient.getAccessToken.mockRejectedValue(error);

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getAccessToken()).rejects.toThrow(
        'Authentication failed: Error: Token request failed',
      );
    });
  });

  describe('getGrpcCredentials', () => {
    beforeEach(() => {
      mockClient.getAccessToken.mockResolvedValue({ token: 'test-token' });
    });

    it('should create gRPC credentials successfully', async () => {
      const manager = new GoogleAuthManager(authConfig);
      const credentials = await manager.getGrpcCredentials();

      expect(mockGoogleAuth.getClient).toHaveBeenCalled();
      expect(mockClient.getAccessToken).toHaveBeenCalled();
      expect(credentials).toBeDefined();
      expect(grpc.credentials.createSsl).toHaveBeenCalled();
      expect(grpc.credentials.createFromMetadataGenerator).toHaveBeenCalled();
      expect(grpc.credentials.combineChannelCredentials).toHaveBeenCalled();
    });

    it('should include Bearer token in metadata', async () => {
      const token = 'test-bearer-token';
      mockClient.getAccessToken.mockResolvedValue({ token });

      const manager = new GoogleAuthManager(authConfig);
      await manager.getGrpcCredentials();

      expect(grpc.credentials.createFromMetadataGenerator).toHaveBeenCalled();
      const metadataGenerator = (grpc.credentials.createFromMetadataGenerator as jest.Mock).mock.calls[0][0];
      expect(typeof metadataGenerator).toBe('function');
    });

    it('should handle errors when getting access token', async () => {
      const error = new Error('Token error');
      mockClient.getAccessToken.mockRejectedValue(error);

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getGrpcCredentials()).rejects.toThrow(
        'Failed to create gRPC credentials: Error: Authentication failed: Error: Token error',
      );
    });
  });

  describe('getMetadata', () => {
    it('should create metadata with Bearer token successfully', async () => {
      const token = 'test-metadata-token';
      mockClient.getAccessToken.mockResolvedValue({ token });

      const manager = new GoogleAuthManager(authConfig);
      const metadata = await manager.getMetadata();

      expect(mockGoogleAuth.getClient).toHaveBeenCalled();
      expect(mockClient.getAccessToken).toHaveBeenCalled();
      expect(metadata).toBeDefined();
      expect(metadata.add).toHaveBeenCalledWith('authorization', `Bearer ${token}`);
    });

    it('should handle errors when getting access token', async () => {
      const error = new Error('Token error');
      mockClient.getAccessToken.mockRejectedValue(error);

      const manager = new GoogleAuthManager(authConfig);

      await expect(manager.getMetadata()).rejects.toThrow(
        'Failed to create metadata: Error: Authentication failed: Error: Token error',
      );
    });
  });

  describe('getAuthClient', () => {
    it('should return the GoogleAuth client instance', () => {
      const manager = new GoogleAuthManager(authConfig);
      const client = manager.getAuthClient();

      expect(client).toBe(mockGoogleAuth);
    });
  });
});

