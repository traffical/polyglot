use polyglot_sql::{ColumnResolutionReason, ColumnResolutionTarget, Error as CoreError};
use pyo3::exceptions::{PyException, PyValueError};
use pyo3::prelude::*;
use pyo3::{create_exception, PyErr};

create_exception!(_polyglot_sql, PolyglotError, PyException);
create_exception!(_polyglot_sql, ParseError, PolyglotError);
create_exception!(_polyglot_sql, GenerateError, PolyglotError);
create_exception!(_polyglot_sql, TranspileError, PolyglotError);
create_exception!(_polyglot_sql, ValidationError, PolyglotError);
create_exception!(_polyglot_sql, ColumnResolutionError, TranspileError);

pub fn unknown_dialect_error(name: &str) -> PyErr {
    PyValueError::new_err(format!("Unknown dialect: {name}"))
}

pub fn parse_statement_count_error(count: usize) -> PyErr {
    ParseError::new_err(format!("Expected 1 statement, found {count}"))
}

pub fn map_parse_error(err: CoreError) -> PyErr {
    match err {
        CoreError::Parse { .. } | CoreError::Tokenize { .. } | CoreError::Syntax { .. } => {
            ParseError::new_err(err.to_string())
        }
        _ => PolyglotError::new_err(err.to_string()),
    }
}

pub fn map_generate_error(err: CoreError) -> PyErr {
    match err {
        CoreError::Generate(_) => GenerateError::new_err(err.to_string()),
        CoreError::Parse { .. } | CoreError::Tokenize { .. } | CoreError::Syntax { .. } => {
            ParseError::new_err(err.to_string())
        }
        _ => GenerateError::new_err(err.to_string()),
    }
}

pub fn map_transpile_error(err: CoreError) -> PyErr {
    match err {
        CoreError::ColumnResolution { target, reason } => column_resolution_error(target, reason),
        CoreError::Generate(_) => GenerateError::new_err(err.to_string()),
        CoreError::Parse { .. } | CoreError::Tokenize { .. } | CoreError::Syntax { .. } => {
            ParseError::new_err(err.to_string())
        }
        _ => TranspileError::new_err(err.to_string()),
    }
}

fn column_resolution_error(
    target: ColumnResolutionTarget,
    reason: ColumnResolutionReason,
) -> PyErr {
    let message = format!("Cannot resolve {target}: {reason}");
    let (column, ordinal) = match target {
        ColumnResolutionTarget::Name { name } => (Some(name), None),
        ColumnResolutionTarget::Ordinal { ordinal } => (None, Some(ordinal)),
    };
    let reason = match reason {
        ColumnResolutionReason::NotFound => "not_found",
        ColumnResolutionReason::Indeterminate => "indeterminate",
        ColumnResolutionReason::Ambiguous => "ambiguous",
    };
    let error = ColumnResolutionError::new_err(message);
    Python::attach(|py| {
        let value = error.value(py);
        let _ = value.setattr("reason", reason);
        let _ = value.setattr("column", column);
        let _ = value.setattr("ordinal", ordinal);
    });
    error
}

pub fn register_exceptions(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("PolyglotError", m.py().get_type::<PolyglotError>())?;
    m.add("ParseError", m.py().get_type::<ParseError>())?;
    m.add("GenerateError", m.py().get_type::<GenerateError>())?;
    m.add("TranspileError", m.py().get_type::<TranspileError>())?;
    m.add("ValidationError", m.py().get_type::<ValidationError>())?;
    m.add(
        "ColumnResolutionError",
        m.py().get_type::<ColumnResolutionError>(),
    )?;
    Ok(())
}
