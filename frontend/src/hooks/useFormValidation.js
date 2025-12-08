import { useState, useCallback, useMemo } from 'react';

/**
 * Hook para validación de formularios en tiempo real
 * Proporciona manejo de valores, errores, y validación con debounce
 *
 * @param {Object} initialValues - Valores iniciales del formulario
 * @param {Object} validationRules - Reglas de validación por campo
 * @param {number} debounceDelay - Delay para validación (default: 300ms)
 *
 * @example
 * const { values, errors, touched, handleChange, handleBlur, handleSubmit, isValid, resetForm } =
 *   useFormValidation(
 *     { email: '', nombre: '' },
 *     {
 *       email: (value) => {
 *         if (!value) return 'Email requerido';
 *         if (!/\S+@\S+\.\S+/.test(value)) return 'Email inválido';
 *         return null;
 *       },
 *       nombre: (value) => (!value ? 'Nombre requerido' : null)
 *     }
 *   );
 */
export function useFormValidation(initialValues = {}, validationRules = {}, _debounceDelay = 300) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Valida un campo específico
   */
  const validateField = useCallback(
    (fieldName, value) => {
      const validator = validationRules[fieldName];
      if (!validator) return null;

      try {
        const error = validator(value, values);
        return error || null;
      } catch (err) {
        console.error(`Error validando campo ${fieldName}:`, err);
        return 'Error de validación';
      }
    },
    [validationRules, values]
  );

  /**
   * Valida todos los campos del formulario
   */
  const validateAllFields = useCallback(() => {
    const newErrors = {};
    let hasErrors = false;

    Object.keys(validationRules).forEach((fieldName) => {
      const error = validateField(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  }, [validationRules, values, validateField]);

  /**
   * Maneja cambios en los inputs
   */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setValues((prev) => ({
      ...prev,
      [name]: fieldValue,
    }));

    // Validar inmediatamente si el campo ya fue tocado
    if (touched[name]) {
      const error = validateField(name, fieldValue);
      setErrors((prev) => ({
        ...prev,
        [name]: error,
      }));
    }
  }, [touched, validateField]);

  /**
   * Maneja cuando un campo pierde el foco
   */
  const handleBlur = useCallback((e) => {
    const { name } = e.target;

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    // Validar el campo al perder el foco
    const error = validateField(name, values[name]);
    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  }, [values, validateField]);

  /**
   * Maneja el envío del formulario
   */
  const handleSubmit = useCallback(
    (onSubmit) => {
      return async (e) => {
        if (e) {
          e.preventDefault();
        }

        // Marcar todos los campos como tocados
        const allTouched = Object.keys(validationRules).reduce(
          (acc, key) => ({ ...acc, [key]: true }),
          {}
        );
        setTouched(allTouched);

        // Validar todos los campos
        const isValid = validateAllFields();

        if (!isValid) {
          return;
        }

        // Ejecutar callback de envío
        setIsSubmitting(true);
        try {
          await onSubmit(values);
        } catch (error) {
          console.error('Error en submit:', error);
          throw error;
        } finally {
          setIsSubmitting(false);
        }
      };
    },
    [validationRules, values, validateAllFields]
  );

  /**
   * Resetea el formulario a valores iniciales
   */
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  /**
   * Establece un valor específico
   */
  const setFieldValue = useCallback((fieldName, value) => {
    setValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  /**
   * Establece un error específico
   */
  const setFieldError = useCallback((fieldName, error) => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));
  }, []);

  /**
   * Establece múltiples valores a la vez
   */
  const setFieldValues = useCallback((newValues) => {
    setValues((prev) => ({
      ...prev,
      ...newValues,
    }));
  }, []);

  /**
   * Verifica si el formulario es válido
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0 && Object.keys(touched).length > 0;
  }, [errors, touched]);

  /**
   * Obtiene el error de un campo si fue tocado
   */
  const getFieldError = useCallback(
    (fieldName) => {
      return touched[fieldName] ? errors[fieldName] : null;
    },
    [errors, touched]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError,
    setFieldValues,
    getFieldError,
    validateAllFields,
  };
}

export default useFormValidation;
