import { SearchIcon } from '@sanity/icons/Search';
import { TextInput } from '@sanity/ui';
import { useEffect } from 'react';
import styled from 'styled-components';

import { useBulkActionsTableContext, useSearchContext } from '../context';
import { sanitizeGroqInput } from '../utils/sanitization';

const SearchForm = styled.form`
  display: flex;
  gap: 0.5rem;
`;

const DEBOUNCE_MS = 200;

function SearchField() {
  const { paginatedClient } = useBulkActionsTableContext();
  const { searchValue, setSearchValue } = useSearchContext();

  const { setUserQuery } = paginatedClient;
  useEffect(() => {
    const timeout = setTimeout(() => {
      // sanitizeGroqInput already strips everything unsafe for the `match "…*"`
      // literal it's used in, so there's nothing left to reject — just pass it through.
      setUserQuery(sanitizeGroqInput(searchValue));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchValue, setUserQuery]);

  return (
    <SearchForm onSubmit={(e) => e.preventDefault()}>
      <TextInput
        placeholder="Search"
        value={searchValue}
        fontSize={1}
        padding={2}
        icon={SearchIcon}
        onChange={(event) => setSearchValue(event.currentTarget.value)}
      />
    </SearchForm>
  );
}

export default SearchField;
