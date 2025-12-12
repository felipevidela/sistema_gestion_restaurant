import { useState, useEffect } from 'react';
import { Form, Row, Col } from 'react-bootstrap';

/**
 * Selector de hora con dropdowns separados para PM (12 PM - 11 PM)
 * Garantiza que solo se generen valores en el rango 12:00-23:00 (formato 24h)
 *
 * @param {string} value - Hora en formato 24h (HH:MM)
 * @param {function} onChange - Callback con hora en formato 24h (HH:MM)
 * @param {string} label - Etiqueta del campo
 * @param {boolean} required - Campo requerido
 */
function TimeSelector({ value = '', onChange, label, required = false }) {
  const [hour12, setHour12] = useState('12');
  const [minutes, setMinutes] = useState('00');

  // Convertir valor 24h → componentes 12h (solo PM)
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      const hour24 = parseInt(h);
      setMinutes(m);

      if (hour24 === 12) {
        setHour12('12');
      } else if (hour24 > 12) {
        setHour12(String(hour24 - 12));
      } else {
        // Fallback seguro (backend no debería enviar < 12)
        setHour12('12');
      }
    }
  }, [value]);

  // Convertir componentes 12h → formato 24h (solo PM)
  const handleChange = (newHour12, newMinutes) => {
    let hour24;
    if (newHour12 === '12') {
      hour24 = 12;  // 12 PM → 12:00
    } else {
      hour24 = parseInt(newHour12) + 12;  // 1 PM → 13:00, ..., 11 PM → 23:00
    }

    const formatted = `${String(hour24).padStart(2, '0')}:${newMinutes}`;
    onChange(formatted);
  };

  return (
    <Form.Group>
      <Form.Label>
        {label} {required && <span className="text-danger">*</span>}
      </Form.Label>
      <Row className="g-2">
        <Col xs={6}>
          <Form.Select
            size="sm"
            value={hour12}
            onChange={(e) => {
              setHour12(e.target.value);
              handleChange(e.target.value, minutes);
            }}
            required={required}
          >
            {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => (
              <option key={h} value={h}>{h} PM</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={6}>
          <Form.Select
            size="sm"
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
              handleChange(hour12, e.target.value);
            }}
            required={required}
          >
            <option value="00">:00</option>
            <option value="15">:15</option>
            <option value="30">:30</option>
            <option value="45">:45</option>
          </Form.Select>
        </Col>
      </Row>
    </Form.Group>
  );
}

export default TimeSelector;
