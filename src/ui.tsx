import { h } from 'preact'
import { useCallback } from 'preact/hooks'
import { Button, Container, render, Stack, Text, VerticalSpace } from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'

function Plugin() {
  const handleCreateComponentClick = useCallback(function () {
    emit('IMAGE_ANALYSIS_COMPLETE', { success: true })
  }, [])

  const handleCloseButtonClick = useCallback(function () {
    emit('CLOSE_PLUGIN')
  }, [])

  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      <Text>
        <h2>Stickerverse Plugin</h2>
      </Text>
      <VerticalSpace space="medium" />
      
      <Stack space="extraSmall">
        <Text>
          <p>Create beautiful UI components!</p>
        </Text>
      </Stack>

      <VerticalSpace space="large" />
      
      <Stack space="small">
        <Button fullWidth onClick={handleCreateComponentClick}>
          Create Component
        </Button>
        <Button fullWidth onClick={handleCloseButtonClick} secondary>
          Close
        </Button>
      </Stack>
      <VerticalSpace space="small" />
    </Container>
  )
}

export default render(Plugin)
