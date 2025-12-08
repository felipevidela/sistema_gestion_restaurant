import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getCurrentUser, isAuthenticated } from '../services/reservasApi';

const AuthContext = createContext(null);

/**
 * Hook para usar el contexto de autenticación
 * @returns {Object} - { user, isAuthenticated, login, logout, updateUser, isLoading }
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

/**
 * Provider del contexto de autenticación
 * Centraliza toda la lógica de autenticación de la aplicación
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inicializar usuario desde localStorage al montar
  useEffect(() => {
    const initAuth = () => {
      try {
        if (isAuthenticated()) {
          const currentUser = getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error al inicializar autenticación:', error);
        // Si hay error, limpiar datos posiblemente corruptos
        apiLogout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login de usuario
   * @param {Object} credentials - { username, password }
   * @returns {Promise<Object>} - Datos del usuario
   */
  const login = useCallback(async (credentials) => {
    try {
      setIsLoading(true);
      const response = await apiLogin(credentials);

      const userData = {
        id: response.user_id,
        username: response.username,
        email: response.email,
        rol: response.rol,
        rol_display: response.rol_display,
        nombre_completo: response.nombre_completo,
      };

      setUser(userData);
      return userData;
    } catch (error) {
      // Re-lanzar el error para que el componente lo maneje
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout de usuario
   */
  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  /**
   * Actualizar datos del usuario actual
   * @param {Object} updates - Datos a actualizar
   */
  const updateUser = useCallback((updates) => {
    setUser((prevUser) => {
      if (!prevUser) return null;

      const updatedUser = { ...prevUser, ...updates };

      // Actualizar también en localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser));

      return updatedUser;
    });
  }, []);

  /**
   * Registrar usuario y hacer auto-login
   * @param {Object} userData - Datos del usuario y reserva
   * @returns {Promise<Object>} - Datos del usuario
   */
  const registerAndLogin = useCallback(async (userData) => {
    try {
      setIsLoading(true);

      const newUser = {
        id: userData.user_id,
        username: userData.username,
        email: userData.email,
        rol: userData.rol,
        rol_display: userData.rol_display,
        nombre_completo: userData.nombre_completo,
      };

      setUser(newUser);
      return newUser;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Verificar si el usuario tiene un rol específico
   * @param {string|string[]} roles - Rol o array de roles a verificar
   * @returns {boolean}
   */
  const hasRole = useCallback((roles) => {
    if (!user) return false;

    const rolesArray = Array.isArray(roles) ? roles : [roles];
    return rolesArray.includes(user.rol);
  }, [user]);

  /**
   * Verificar si el usuario tiene permiso para una acción
   * @param {string} permission - Permiso a verificar
   * @returns {boolean}
   */
  const hasPermission = useCallback((permission) => {
    if (!user) return false;

    // Definir permisos por rol
    const permissions = {
      admin: ['*'], // Admin tiene todos los permisos
      cajero: [
        'view_reservations',
        'update_reservation_status',
        'view_all_reservations',
      ],
      mesero: [
        'view_reservations',
        'view_tables',
        'update_table_status',
      ],
      cliente: [
        'create_reservation',
        'view_own_reservations',
        'cancel_own_reservation',
        'update_profile',
      ],
    };

    const userPermissions = permissions[user.rol] || [];

    // Si el usuario es admin, tiene todos los permisos
    if (userPermissions.includes('*')) return true;

    return userPermissions.includes(permission);
  }, [user]);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
    registerAndLogin,
    hasRole,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
