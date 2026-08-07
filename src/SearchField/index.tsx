import {SearchIcon} from '@sanity/icons/Search'
import {TextInput} from '@sanity/ui'
import {useEffect} from 'react'
import styled from 'styled-components'

import {useBulkActionsTableContext, useLabels, useSearchContext} from '../context'

const SearchForm = styled.form`
  display: flex;
  gap: 0.5rem;
  /* The field grows with the bar. The selector has to target all children
     rather than div: @sanity/ui renders TextInput as a <span>, so a rule
     written for div matched nothing and the field kept its default width. */
  width: 100%;

  > * {
    flex: 1;
    min-width: 0;
  }

  input {
    width: 100%;
  }
`

const DEBOUNCE_MS = 200

function SearchField() {
  const {paginatedClient} = useBulkActionsTableContext()
  const {searchValue, setSearchValue} = useSearchContext()
  const labels = useLabels()

  const {setUserQuery} = paginatedClient
  useEffect(() => {
    // The term travels to GROQ as the `$q` parameter, so there is nothing to
    // sanitize here - trimming whitespace and length is enough.
    const timeout = setTimeout(() => {
      setUserQuery(searchValue.trim().slice(0, 100))
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [searchValue, setUserQuery])

  return (
    <SearchForm onSubmit={(e) => e.preventDefault()}>
      <TextInput
        placeholder={labels.search}
        value={searchValue}
        fontSize={1}
        padding={2}
        icon={SearchIcon}
        onChange={(event) => setSearchValue(event.currentTarget.value)}
      />
    </SearchForm>
  )
}

export default SearchField
